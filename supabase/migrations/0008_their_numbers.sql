-- Couples Party, migration 8: Their Numbers — five numbers about yourself.
--
-- Run once in the SQL Editor, after 0007.
--
-- Its own card, like the other three — the last before they all merge into one
-- rotating slot (see docs/ROADMAP.md). Reuses 0005's payload/progress columns.
--
-- Five questions a day, the same five for both of you ("countries you've been to",
-- "out of 10, how tidy you are"). You answer them about yourself with whole numbers;
-- your partner guesses all five at once. Each guess is exact, close (within a fifth of
-- your number, and never tighter than one either side — so a 7 out of 10 takes 6 or 8),
-- or off. `payload` holds the questions (pinned for the day) and your answers;
-- `progress` the guesses and how each landed.

alter table public.puzzles drop constraint puzzles_kind_check;
alter table public.puzzles add constraint puzzles_kind_check
  check (kind in ('word', 'dial', 'top5', 'sketch', 'numbers'));

-- How one guess landed against one answer.
create function public.numbers_mark(p_guess int, p_answer int)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_guess = p_answer then 'exact'
    when abs(p_guess - p_answer) <= greatest(1, floor(abs(p_answer) * 0.2)) then 'close'
    else 'off'
  end
$$;
revoke all on function public.numbers_mark(int, int) from public, anon, authenticated;

-- Five whole numbers, each 0 to 9999.
create function public.is_five_numbers(p int[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null and array_length(p, 1) = 5
    and not exists (select 1 from unnest(p) x where x is null or x < 0 or x > 9999)
$$;
revoke all on function public.is_five_numbers(int[]) from public, anon, authenticated;

-- What the solver may see: the questions (there's nothing to guess without them), never
-- the answers until they've guessed — unless they're yours.
create function public.numbers_view(p public.puzzles, p_viewer uuid)
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
    'questions', p.payload -> 'questions',
    'answers', case when p.status <> 'open' or p_viewer = p.setter then p.payload -> 'answers' end,
    'guesses', p.progress -> 'guesses',
    'marks', p.progress -> 'marks',
    'status', p.status
  )
$$;
revoke all on function public.numbers_view(public.puzzles, uuid) from public, anon, authenticated;

-- Answer today's five. Mirrors the others: the couple shares one set a day — whoever's
-- first fixes the questions — changeable until your partner has guessed.
create function public.set_numbers(p_for_date date, p_questions text[], p_answers int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mine uuid;
  them uuid;
  questions text[] := p_questions;
  existing public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null then raise exception 'not paired'; end if;
  if p_questions is null or array_length(p_questions, 1) <> 5
     or exists (select 1 from unnest(p_questions) q where char_length(trim(q)) = 0) then
    raise exception 'five questions, please';
  end if;
  if not public.is_five_numbers(p_answers) then raise exception 'five whole numbers, 0 to 9999'; end if;
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select array(select jsonb_array_elements_text(payload -> 'questions'))
    into questions
    from public.puzzles
   where setter = them and for_date = p_for_date and kind = 'numbers';
  questions := coalesce(questions, p_questions);

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'numbers';
  if found then
    if existing.progress is not null then raise exception 'they have already started it'; end if;
    update public.puzzles
       set payload = jsonb_build_object('questions', to_jsonb(questions), 'answers', to_jsonb(p_answers))
     where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, payload)
    values (mine, me, them, p_for_date, 'numbers', 'Their Numbers', '',
            jsonb_build_object('questions', to_jsonb(questions), 'answers', to_jsonb(p_answers)));
  end if;
end;
$$;

-- All five guesses, once — like The Dial and Top 5, a repeat call just hands back what
-- you already got.
create function public.submit_numbers(p_puzzle uuid, p_guesses int[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p public.puzzles;
  answers int[];
  marks text[];
begin
  select * into p from public.puzzles where id = p_puzzle for update;
  if not found or p.solver <> me then raise exception 'no such puzzle'; end if;
  if not exists (
    select 1 from public.puzzles where setter = me and for_date = p.for_date and kind = 'numbers'
  ) then
    raise exception 'answer yours first';
  end if;
  if p.status <> 'open' then return public.numbers_view(p, me); end if;
  if not public.is_five_numbers(p_guesses) then raise exception 'five whole numbers, 0 to 9999'; end if;

  answers := array(select jsonb_array_elements_text(p.payload -> 'answers'))::int[];
  marks := array(select public.numbers_mark(p_guesses[i], answers[i]) from generate_series(1, 5) i order by i);

  update public.puzzles
     set progress = jsonb_build_object('guesses', to_jsonb(p_guesses), 'marks', to_jsonb(marks)),
         status = 'solved',
         finished_at = now()
   where id = p.id;
  return public.numbers_view((select pz from public.puzzles pz where pz.id = p.id), me);
end;
$$;

-- Everything the Their Numbers card needs, in one call — same shape as the others.
create function public.daily_numbers(p_today date)
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

  select * into mine from public.puzzles where setter = me and for_date = p_today and kind = 'numbers';
  select * into theirs from public.puzzles where solver = me and for_date = p_today and kind = 'numbers';

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'questions', coalesce(mine.payload -> 'questions', theirs.payload -> 'questions'),
    'mine', case when mine.id is not null then public.numbers_view(mine, me) end,
    'theirs', case
      when theirs.id is null then null
      when mine.id is null then jsonb_build_object('locked', true)
      else public.numbers_view(theirs, me)
    end
  );
end;
$$;

revoke all on function public.set_numbers(date, text[], int[]) from public, anon, authenticated;
revoke all on function public.submit_numbers(uuid, int[]) from public, anon, authenticated;
revoke all on function public.daily_numbers(date) from public, anon, authenticated;

grant execute on function public.set_numbers(date, text[], int[]) to authenticated;
grant execute on function public.submit_numbers(uuid, int[]) to authenticated;
grant execute on function public.daily_numbers(date) to authenticated;
