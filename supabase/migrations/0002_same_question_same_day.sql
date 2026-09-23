-- Couples Party, migration 2: one question a day, the same for both of you, solved the
-- same day.
--
-- Run once in the SQL Editor, after 0001. It only replaces three functions; no tables
-- change and nothing is deleted. (Replacing a function keeps its permissions.)
--
-- What changes:
-- - Each day you both answer the same question. Whoever answers first fixes the
--   question for the couple that day — the second answer is filed under it whatever
--   the second phone sent, so a content update mid-day can't split you onto two.
-- - You can't see or play your partner's answer until you've given your own, so their
--   word can never sway yours. The server enforces this, not just the app.

-- Everything the Today card needs. `theirs` is null if they haven't answered, and
-- {"locked": true} if they have but you haven't — so the app can say "your turn".
create or replace function public.daily(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_row public.members;
  partner public.members;
  couple public.couples;
  mine public.puzzles;
  theirs public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single'); end if;

  select * into couple from public.couples where id = my_row.couple_id;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then
    return jsonb_build_object('state', 'waiting', 'code', couple.code, 'me', my_row.name);
  end if;

  select * into mine from public.puzzles where setter = me and for_date = p_today and kind = 'word';
  select * into theirs from public.puzzles where solver = me and for_date = p_today and kind = 'word';

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    -- The day's question, once either of you has answered it.
    'question', coalesce(mine.prompt, theirs.prompt),
    -- Yours: your answer, and how they're getting on with it.
    'mine', case when mine.id is not null then public.puzzle_view(mine, me) end,
    -- Theirs: hidden until you've answered.
    'theirs', case
      when theirs.id is null then null
      when mine.id is null then jsonb_build_object('locked', true)
      else public.puzzle_view(theirs, me)
    end
  );
end;
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
  if word !~ '^[a-z]{5}$' then raise exception 'five letters, a to z'; end if;
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
  if word !~ '^[a-z]{5}$' then raise exception 'five letters, a to z'; end if;

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
