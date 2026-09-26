-- Coupled, migration 17: This or That — the sixth daily puzzle.
--
-- Run once in the SQL Editor, after 0016.
--
-- Five quick either/ors a day ("Tea | Coffee", "Early bird | Night owl"), the same
-- five for both of you. You pick your side of each; your partner predicts all five at
-- once. Two points a match, so ten for reading them perfectly — the same out-of-10 as
-- every other puzzle. `payload` holds the pairs (pinned for the day) and your picks
-- (0 for the first of each pair, 1 for the second); `progress` their predictions and
-- how many matched.
--
-- Everything else carries on as before: board() now lists six kinds, and points,
-- streak, memories and the week all pick it up through puzzle_points() and any_view().

alter table public.puzzles drop constraint puzzles_kind_check;
alter table public.puzzles add constraint puzzles_kind_check
  check (kind in ('word', 'dial', 'top5', 'sketch', 'numbers', 'either'));

-- Five picks, each 0 (this) or 1 (that).
create function public.is_five_picks(p int[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null and array_length(p, 1) = 5
    and not exists (select 1 from unnest(p) x where x is null or x not in (0, 1))
$$;
revoke all on function public.is_five_picks(int[]) from public, anon, authenticated;

-- What the solver may see: the pairs, never the picks until they've predicted — unless
-- they're yours.
create function public.either_view(p public.puzzles, p_viewer uuid)
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
    'matches', (p.progress ->> 'matches')::int,
    'status', p.status
  )
$$;
revoke all on function public.either_view(public.puzzles, uuid) from public, anon, authenticated;

-- Pick your five. Like the others: the couple shares one set of pairs a day — whoever's
-- first fixes them — changeable until your partner has predicted.
create function public.set_either(p_for_date date, p_questions text[], p_answers int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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
     or exists (select 1 from unnest(p_questions) q where char_length(trim(q)) = 0 or char_length(q) > 120) then
    raise exception 'five pairs, please';
  end if;
  if not public.is_five_picks(p_answers) then raise exception 'pick one of each pair'; end if;
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select array(select jsonb_array_elements_text(payload -> 'questions'))
    into questions
    from public.puzzles
   where setter = them and for_date = p_for_date and kind = 'either';
  questions := coalesce(questions, p_questions);

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'either';
  if found then
    if existing.progress is not null then raise exception 'they have already started it'; end if;
    update public.puzzles
       set payload = jsonb_build_object('questions', to_jsonb(questions), 'answers', to_jsonb(p_answers))
     where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, payload)
    values (mine, me, them, p_for_date, 'either', 'This or That', '',
            jsonb_build_object('questions', to_jsonb(questions), 'answers', to_jsonb(p_answers)));
  end if;
end;
$$;

-- All five predictions, once — a repeat call just hands back what you already got.
create function public.submit_either(p_puzzle uuid, p_guesses int[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  p public.puzzles;
  answers int[];
  matches int;
begin
  select * into p from public.puzzles where id = p_puzzle for update;
  if not found or p.solver <> me then raise exception 'no such puzzle'; end if;
  if p.status <> 'open' then return public.either_view(p, me); end if;
  if not public.is_five_picks(p_guesses) then raise exception 'pick one of each pair'; end if;

  answers := array(select jsonb_array_elements_text(p.payload -> 'answers'))::int[];
  select count(*) into matches from generate_series(1, 5) i where p_guesses[i] = answers[i];

  update public.puzzles
     set progress = jsonb_build_object('guesses', to_jsonb(p_guesses), 'matches', matches),
         status = 'solved',
         finished_at = now()
   where id = p.id;
  return public.either_view((select pz from public.puzzles pz where pz.id = p.id), me);
end;
$$;

revoke all on function public.set_either(date, text[], int[]) from public, anon, authenticated;
revoke all on function public.submit_either(uuid, int[]) from public, anon, authenticated;
grant execute on function public.set_either(date, text[], int[]) to authenticated;
grant execute on function public.submit_either(uuid, int[]) to authenticated;

-- ---------------------------------------------------------------- points, views, board

-- puzzle_points(puzzles), as of 0010_solve_then_set.sql — plus This or That, 2 a match.
create or replace function public.puzzle_points(p public.puzzles)
returns int
language sql
stable
set search_path = ''
as $$
  select case
    when p.status = 'open' then 0
    when p.kind = 'word' then
      case when p.status <> 'solved' then 0
           else (array[10, 8, 6, 4, 3, 2])[least(cardinality(p.guesses), 6)] end
    when p.kind = 'dial' then
      case when (p.progress ->> 'distance')::int = 0 then 10
           when (p.progress ->> 'distance')::int <= 5 then 7
           when (p.progress ->> 'distance')::int <= 15 then 4
           else 0 end
    when p.kind = 'top5' then 2 * (p.progress ->> 'exact')::int + (p.progress ->> 'near')::int
    when p.kind = 'sketch' then
      case when p.status <> 'solved' then 0
           else (array[10, 6, 3])[least(jsonb_array_length(p.progress -> 'guesses'), 3)] end
    when p.kind = 'numbers' then
      (select coalesce(sum(case m when 'exact' then 2 when 'close' then 1 else 0 end), 0)::int
         from jsonb_array_elements_text(p.progress -> 'marks') m)
    when p.kind = 'either' then 2 * coalesce((p.progress ->> 'matches')::int, 0)
    else 0
  end
$$;

-- any_view(puzzles,uuid), as of 0010_solve_then_set.sql — plus This or That.
create or replace function public.any_view(p public.puzzles, p_viewer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select (case p.kind
    when 'word' then public.puzzle_view(p, p_viewer)
    when 'dial' then public.dial_view(p, p_viewer)
    when 'top5' then public.top5_view(p, p_viewer)
    when 'sketch' then public.sketch_view(p, p_viewer)
    when 'numbers' then public.numbers_view(p, p_viewer)
    when 'either' then public.either_view(p, p_viewer)
  end) || jsonb_build_object('points', case when p.status <> 'open' then public.puzzle_points(p) end)
$$;

-- board(date), as of 0015_more_than_one_device.sql — six kinds now.
create or replace function public.board(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  my_row public.members;
  partner public.members;
  couple public.couples;
  k text;
  kinds jsonb := '{}'::jsonb;
  s public.puzzles;
  m public.puzzles;
  n public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single'); end if;

  select * into couple from public.couples where id = my_row.couple_id;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then
    return jsonb_build_object('state', 'waiting', 'code', couple.code, 'me', my_row.name);
  end if;

  foreach k in array array['word', 'dial', 'top5', 'sketch', 'numbers', 'either'] loop
    select * into s from public.puzzles where solver = me and for_date = p_today and kind = k;
    select * into m from public.puzzles where setter = me and for_date = p_today and kind = k;
    select * into n from public.puzzles where setter = me and for_date = p_today + 1 and kind = k;
    kinds := kinds || jsonb_build_object(k, jsonb_build_object(
      'solve', case when s.id is not null then public.any_view(s, me) end,
      'mine', case when m.id is not null then public.any_view(m, me) end,
      'next', case when n.id is not null then public.any_view(n, me) end
    ));
  end loop;

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'kinds', kinds,
    'today', jsonb_build_object(
      'me', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = couple.id and p.solver = me and p.for_date = p_today),
      'them', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = couple.id and p.solver = partner.user_id and p.for_date = p_today)),
    'total', jsonb_build_object(
      'me', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = couple.id and p.solver = me),
      'them', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = couple.id and p.solver = partner.user_id)),
    'streak', public.couple_streak(couple.id, p_today)
  );
end;
$$;
