-- Coupled, migration 16: the week, the team, and a kinder streak.
--
-- Run once in the SQL Editor, after 0015.
--
-- The Today board now leads with the week, not all time: the crown goes to whoever's
-- ahead since Monday, and resets every Monday. Beside today's head-to-head there's a
-- team total — both of you added together — with your best day as a couple to beat.
-- And the streak says how many of the last seven days you both played, so one missed
-- day never reads as a failure.
--
-- All of that comes from one new function, board_stats(). board() is unchanged.

create function public.board_stats(p_today date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  my_row public.members;
  partner public.members;
  monday date := date_trunc('week', p_today)::date; -- ISO weeks start on Monday
  best int;
  played int;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single'); end if;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then return jsonb_build_object('state', 'waiting'); end if;

  -- Your best day together, before today: the most points the two of you scored on one day.
  select max(day_total) into best from (
    select sum(public.puzzle_points(p)) as day_total
      from public.puzzles p
     where p.couple_id = my_row.couple_id and p.for_date < p_today
     group by p.for_date
  ) days;

  -- Of the last seven days (today included), how many you both played — the streak's
  -- own rule: each of you solved one of that day's puzzles or set one for the next.
  select count(*) into played
    from generate_series(p_today - 6, p_today, interval '1 day') g(day)
   where (select count(distinct who) from (
            select p.solver as who from public.puzzles p
             where p.couple_id = my_row.couple_id and p.for_date = g.day::date and p.status <> 'open'
            union
            select p.setter from public.puzzles p
             where p.couple_id = my_row.couple_id and p.for_date = g.day::date + 1
          ) t) = 2;

  return jsonb_build_object(
    'state', 'paired',
    'week', jsonb_build_object(
      'me', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = my_row.couple_id and p.solver = me and p.for_date between monday and p_today),
      'them', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = my_row.couple_id and p.solver = partner.user_id and p.for_date between monday and p_today)),
    'lastWeek', jsonb_build_object(
      'me', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = my_row.couple_id and p.solver = me and p.for_date between monday - 7 and monday - 1),
      'them', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = my_row.couple_id and p.solver = partner.user_id and p.for_date between monday - 7 and monday - 1)),
    'bestDay', coalesce(best, 0),
    'daysLast7', coalesce(played, 0)
  );
end;
$$;

revoke all on function public.board_stats(date) from public, anon, authenticated;
grant execute on function public.board_stats(date) to authenticated;
