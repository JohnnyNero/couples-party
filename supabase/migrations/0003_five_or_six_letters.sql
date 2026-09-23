-- Couples Party, migration 3: answers can be five or six letters.
--
-- Run once in the SQL Editor, after 0002. Like 0002 it only replaces functions; no
-- tables change and nothing is deleted. (Replacing a function keeps its permissions.)
--
-- What changes:
-- - An answer can be five letters or six. Six lets in a lot of what people actually
--   say — coffee, crisps, cheese, stormy, grumpy, pirate, travel — that five turned away.
-- - The solver is told the length (it's how many tiles they get), and every guess has
--   to be that long.

-- The colouring, for a guess and answer of the same length, whatever that is.
create or replace function public.wordle_pattern(p_guess text, p_answer text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  n int := char_length(p_answer);
  counts int[] := array_fill(0, array[26]);
  result text[] := array_fill('.'::text, array[n]);
  g text;
  a text;
  idx int;
begin
  for i in 1..n loop
    g := substr(p_guess, i, 1);
    a := substr(p_answer, i, 1);
    if g = a then
      result[i] := 'g';
    else
      idx := ascii(a) - 96;
      counts[idx] := counts[idx] + 1;
    end if;
  end loop;
  for i in 1..n loop
    if result[i] <> 'g' then
      idx := ascii(substr(p_guess, i, 1)) - 96;
      if counts[idx] > 0 then
        result[i] := 'y';
        counts[idx] := counts[idx] - 1;
      end if;
    end if;
  end loop;
  return array_to_string(result, '');
end;
$$;

-- What the solver may see of a puzzle: everything but the answer until it's over — and
-- now how long the answer is, so they know how many tiles to fill.
create or replace function public.puzzle_view(p public.puzzles, p_viewer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'forDate', p.for_date,
    'kind', p.kind,
    'prompt', p.prompt,
    'length', char_length(p.answer),
    'guesses', to_jsonb(p.guesses),
    'patterns', coalesce(
      (select jsonb_agg(public.wordle_pattern(g, p.answer) order by n)
         from unnest(p.guesses) with ordinality as t(g, n)),
      '[]'::jsonb),
    'status', p.status,
    'answer', case when p.status <> 'open' or p_viewer = p.setter then p.answer end
  )
$$;

-- Answer today's question. If your partner has already answered today, yours goes
-- under the same question whatever was sent. Changeable until they've made a guess.
create or replace function public.set_word(p_for_date date, p_prompt text, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mine uuid;
  them uuid;
  word text := lower(trim(p_answer));
  question text := p_prompt;
  existing public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null then raise exception 'not paired'; end if;
  if word !~ '^[a-z]{5,6}$' then raise exception 'five or six letters, a to z'; end if;
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select prompt into question from public.puzzles
   where setter = them and for_date = p_for_date and kind = 'word';
  question := coalesce(question, p_prompt);

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'word';
  if found then
    if cardinality(existing.guesses) > 0 then raise exception 'they have already started it'; end if;
    update public.puzzles set prompt = question, answer = word where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer)
    values (mine, me, them, p_for_date, 'word', question, word);
  end if;
end;
$$;

-- One guess at your partner's answer — only once you've given yours for the same day.
create or replace function public.submit_guess(p_puzzle uuid, p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p public.puzzles;
  word text := lower(trim(p_guess));
begin
  select * into p from public.puzzles where id = p_puzzle for update;
  if not found or p.solver <> me then raise exception 'no such puzzle'; end if;
  if not exists (
    select 1 from public.puzzles where setter = me and for_date = p.for_date and kind = p.kind
  ) then
    raise exception 'answer yours first';
  end if;
  if p.status <> 'open' then return public.puzzle_view(p, me); end if;
  -- A guess is the same length as the answer — the solver's grid already shows which.
  if word !~ '^[a-z]+$' or char_length(word) <> char_length(p.answer) then
    raise exception '% letters, a to z', case char_length(p.answer) when 6 then 'six' else 'five' end;
  end if;

  p.guesses := p.guesses || word;
  if word = p.answer then
    p.status := 'solved';
  elsif cardinality(p.guesses) >= 6 then
    p.status := 'failed';
  end if;
  update public.puzzles
     set guesses = p.guesses,
         status = p.status,
         finished_at = case when p.status <> 'open' then now() end
   where id = p.id;
  return public.puzzle_view(p, me);
end;
$$;
