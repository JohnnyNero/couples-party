-- Couples Party, migration 7: Sketch — a daily Draw Your Answer.
--
-- Run once in the SQL Editor, after 0006.
--
-- Its own card, like The Dial and Top 5 — not yet the final rotation (see
-- docs/ROADMAP.md). Reuses 0005's payload/progress columns; no further schema change.
--
-- You answer a question about yourself ("your comfort food") in a word or two, then
-- draw it. Your partner sees the drawing and gets three guesses at what you wrote.
-- There's nobody live to wave a near miss through, so a guess counts when it matches
-- once case, punctuation, spacing and a leading "a"/"an"/"the" are set aside — "Pizza!"
-- is "pizza", "a dog" is "dog". Anything further is for the two of you to argue about.
-- `payload` holds the answer and the strokes; `progress.guesses` the attempts.

alter table public.puzzles drop constraint puzzles_kind_check;
alter table public.puzzles add constraint puzzles_kind_check check (kind in ('word', 'dial', 'top5', 'sketch'));

-- What a guess has to equal, after the forgivable differences are taken out.
create function public.sketch_norm(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(lower(coalesce(p, '')), '[^a-z0-9 ]', '', 'g'),
    '^\s*(a|an|the)\s+|\s+', '', 'g')
$$;
revoke all on function public.sketch_norm(text) from public, anon, authenticated;

-- What the solver may see: the drawing (it's the whole puzzle), never the answer until
-- they've got it or run out — unless it's yours.
create function public.sketch_view(p public.puzzles, p_viewer uuid)
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
    'strokes', p.payload -> 'strokes',
    'guesses', coalesce(p.progress -> 'guesses', '[]'::jsonb),
    'status', p.status,
    'answer', case when p.status <> 'open' or p_viewer = p.setter then p.payload ->> 'answer' end
  )
$$;
revoke all on function public.sketch_view(public.puzzles, uuid) from public, anon, authenticated;

-- Answer and draw today's question. Mirrors the others: one question a day for the
-- couple — whoever's first fixes it — changeable until your partner has guessed.
create function public.set_sketch(p_for_date date, p_prompt text, p_answer text, p_strokes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mine uuid;
  them uuid;
  answer text := trim(p_answer);
  question text := p_prompt;
  existing public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null then raise exception 'not paired'; end if;
  if char_length(answer) < 1 or char_length(answer) > 30 or public.sketch_norm(answer) = '' then
    raise exception 'answer must be 1 to 30 characters';
  end if;
  if p_strokes is null or jsonb_typeof(p_strokes) <> 'array' or jsonb_array_length(p_strokes) = 0 then
    raise exception 'draw something first';
  end if;
  -- Generous for a phone sketch, small enough that nobody's pushing a novel through it.
  if octet_length(p_strokes::text) > 120000 then raise exception 'that drawing is too big'; end if;
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select prompt into question from public.puzzles
   where setter = them and for_date = p_for_date and kind = 'sketch';
  question := coalesce(question, p_prompt);

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'sketch';
  if found then
    if existing.progress is not null then raise exception 'they have already started it'; end if;
    update public.puzzles
       set prompt = question, payload = jsonb_build_object('answer', answer, 'strokes', p_strokes)
     where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, payload)
    values (mine, me, them, p_for_date, 'sketch', question, '',
            jsonb_build_object('answer', answer, 'strokes', p_strokes));
  end if;
end;
$$;

-- One guess at what they drew. Three tries; the answer shows once you've got it or
-- they're used up.
create function public.submit_sketch(p_puzzle uuid, p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p public.puzzles;
  guess text := trim(p_guess);
  tries jsonb;
begin
  select * into p from public.puzzles where id = p_puzzle for update;
  if not found or p.solver <> me then raise exception 'no such puzzle'; end if;
  if not exists (
    select 1 from public.puzzles where setter = me and for_date = p.for_date and kind = 'sketch'
  ) then
    raise exception 'answer yours first';
  end if;
  if p.status <> 'open' then return public.sketch_view(p, me); end if;
  if char_length(guess) < 1 or char_length(guess) > 30 or public.sketch_norm(guess) = '' then
    raise exception 'answer must be 1 to 30 characters';
  end if;

  tries := coalesce(p.progress -> 'guesses', '[]'::jsonb) || to_jsonb(guess);
  update public.puzzles
     set progress = jsonb_build_object('guesses', tries),
         status = case
           when public.sketch_norm(guess) = public.sketch_norm(p.payload ->> 'answer') then 'solved'
           when jsonb_array_length(tries) >= 3 then 'failed'
           else 'open'
         end,
         finished_at = case
           when public.sketch_norm(guess) = public.sketch_norm(p.payload ->> 'answer')
             or jsonb_array_length(tries) >= 3 then now()
         end
   where id = p.id;
  return public.sketch_view((select pz from public.puzzles pz where pz.id = p.id), me);
end;
$$;

-- Everything the Sketch card needs, in one call — same shape as the others.
create function public.daily_sketch(p_today date)
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

  select * into mine from public.puzzles where setter = me and for_date = p_today and kind = 'sketch';
  select * into theirs from public.puzzles where solver = me and for_date = p_today and kind = 'sketch';

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'prompt', coalesce(mine.prompt, theirs.prompt),
    'mine', case when mine.id is not null then public.sketch_view(mine, me) end,
    'theirs', case
      when theirs.id is null then null
      when mine.id is null then jsonb_build_object('locked', true)
      else public.sketch_view(theirs, me)
    end
  );
end;
$$;

revoke all on function public.set_sketch(date, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.submit_sketch(uuid, text) from public, anon, authenticated;
revoke all on function public.daily_sketch(date) from public, anon, authenticated;

grant execute on function public.set_sketch(date, text, text, jsonb) to authenticated;
grant execute on function public.submit_sketch(uuid, text) to authenticated;
grant execute on function public.daily_sketch(date) to authenticated;
