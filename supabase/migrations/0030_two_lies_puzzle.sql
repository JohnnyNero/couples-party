-- Coupled, migration 30: Two Lies & a Truth, as a daily puzzle (in place of Sketch).
--
-- Run once in the SQL Editor, after 0029.
--
-- The day's prompt ("Your worst ever present"), the same for both of you. You write
-- three answers to it, one true and two made up; your partner picks the one they think
-- is true, once. Right is 10, wrong is 0 — the same out-of-10 as every other puzzle.
-- `payload` holds the three (in the order shown) and which is true (0, 1 or 2);
-- `progress` their pick.
--
-- Sketch stays in the database, and board() keeps listing it, so older copies of the
-- app carry on until they update; the app just stops offering it. Its past puzzles stay
-- in Memories.

alter table public.puzzles drop constraint puzzles_kind_check;
alter table public.puzzles add constraint puzzles_kind_check
  check (kind in ('word', 'dial', 'top5', 'sketch', 'numbers', 'either', 'bluff'));

-- What the solver may see: the three, never which is true until they've picked —
-- unless they're yours.
create function public.bluff_view(p public.puzzles, p_viewer uuid)
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
    'statements', p.payload -> 'statements',
    'truth', case when p.status <> 'open' or p_viewer = p.setter then (p.payload ->> 'truth')::int end,
    'pick', (p.progress ->> 'pick')::int,
    'status', p.status
  )
$$;
revoke all on function public.bluff_view(public.puzzles, uuid) from public, anon, authenticated;

-- Write your three. Like the others: the couple shares one prompt a day — whoever's
-- first fixes it — and yours is changeable until your partner has picked.
create function public.set_bluff(p_for_date date, p_prompt text, p_statements text[], p_truth int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  them uuid;
  the_prompt text := btrim(coalesce(p_prompt, ''));
  clean text[];
  existing public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null then raise exception 'not paired'; end if;
  clean := array(select btrim(s) from unnest(coalesce(p_statements, '{}')) s);
  if array_length(clean, 1) is distinct from 3
     or exists (select 1 from unnest(clean) s where char_length(s) not between 1 and 100) then
    raise exception 'three answers, please';
  end if;
  if (select count(distinct lower(s)) from unnest(clean) s) <> 3 then raise exception 'three different answers'; end if;
  if p_truth is null or p_truth not between 0 and 2 then raise exception 'say which one is true'; end if;
  if char_length(the_prompt) not between 1 and 120 then raise exception 'no prompt'; end if;
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select coalesce((select p.prompt from public.puzzles p
                    where p.setter = them and p.for_date = p_for_date and p.kind = 'bluff'), the_prompt)
    into the_prompt;

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'bluff';
  if found then
    if existing.progress is not null then raise exception 'they have already started it'; end if;
    update public.puzzles
       set prompt = the_prompt,
           payload = jsonb_build_object('statements', to_jsonb(clean), 'truth', p_truth)
     where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, payload)
    values (mine, me, them, p_for_date, 'bluff', the_prompt, '',
            jsonb_build_object('statements', to_jsonb(clean), 'truth', p_truth));
  end if;
end;
$$;

-- Your one pick — a repeat call just hands back what you already got.
create function public.submit_bluff(p_puzzle uuid, p_pick int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  p public.puzzles;
begin
  select * into p from public.puzzles where id = p_puzzle for update;
  if not found or p.solver <> me or p.kind <> 'bluff' then raise exception 'no such puzzle'; end if;
  if p.status <> 'open' then return public.bluff_view(p, me); end if;
  if p_pick is null or p_pick not between 0 and 2 then raise exception 'pick one'; end if;

  update public.puzzles
     set progress = jsonb_build_object('pick', p_pick),
         status = case when p_pick = (p.payload ->> 'truth')::int then 'solved' else 'failed' end,
         finished_at = now()
   where id = p.id;
  return public.bluff_view((select pz from public.puzzles pz where pz.id = p.id), me);
end;
$$;

revoke all on function public.set_bluff(date, text, text[], int) from public, anon, authenticated;
revoke all on function public.submit_bluff(uuid, int) from public, anon, authenticated;
grant execute on function public.set_bluff(date, text, text[], int) to authenticated;
grant execute on function public.submit_bluff(uuid, int) to authenticated;

-- ---------------------------------------------------------------- points, views, board

-- puzzle_points(puzzles), as of 0017_this_or_that.sql — plus Two Lies, 10 for the truth.
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
    when p.kind = 'bluff' then case when p.status = 'solved' then 10 else 0 end
    else 0
  end
$$;

-- any_view(puzzles,uuid), as of 0017_this_or_that.sql — plus Two Lies.
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
    when 'bluff' then public.bluff_view(p, p_viewer)
  end) || jsonb_build_object('points', case when p.status <> 'open' then public.puzzle_points(p) end)
$$;

-- board(date), as of 0017_this_or_that.sql — with Two Lies too.
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

  foreach k in array array['word', 'dial', 'top5', 'sketch', 'numbers', 'either', 'bluff'] loop
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
