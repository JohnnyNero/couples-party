-- Coupled, migration 29: the couple leaderboard.
--
-- Run once in the SQL Editor, after 0028.
--
-- Friends get a weekly leaderboard: you and your friend couples, ranked by points since
-- Monday (ISO weeks, as in 0016). A couple's points this week are both partners' puzzle
-- points plus, for each day, the best team score among that day's Today games. Only the
-- total is ever shown — never answers, puzzles or Memories. Worked out when asked, never
-- stored, like every other score here. No tables change.

-- One couple's points this week, as of p_today. Private: callable only from inside the
-- functions below, so nobody can look up a couple that isn't their friend.
create function public.couple_week_points(p_couple uuid, p_today date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    coalesce((select sum(public.puzzle_points(p))
                from public.puzzles p
               where p.couple_id = p_couple
                 and p.for_date between date_trunc('week', p_today)::date and p_today), 0)
    + coalesce((select sum(d.best)
                  from (select max((mo.payload ->> 'team')::numeric) as best
                          from public.moments mo
                         where mo.couple_id = p_couple
                           and mo.payload ->> 'game' = 'tonight'
                           and mo.played_on between date_trunc('week', p_today)::date and p_today
                         group by mo.played_on) d), 0)
  )::int
$$;

-- You and your friends, best first (points, then names, so a tie is stable).
create function public.friend_leaderboard(p_today date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mine uuid := public.my_pair();
begin
  if public.person() is null then raise exception 'not signed in'; end if;
  if mine is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'members', c.members, 'points', c.points, 'me', c.id = mine)
                     order by c.points desc, c.name, c.id)
      from (
        select x.id,
               public.couple_week_points(x.id, p_today) as points,
               coalesce((select jsonb_agg(jsonb_build_object('name', m.name, 'photo', m.photo) order by m.joined_at)
                           from public.members m where m.couple_id = x.id), '[]'::jsonb) as members,
               coalesce((select string_agg(m.name, ' & ' order by m.joined_at)
                           from public.members m where m.couple_id = x.id), '') as name
          from (select mine as id
                union
                select case when f.a = mine then f.b else f.a end
                  from public.friendships f where f.a = mine or f.b = mine) x
      ) c
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.couple_week_points(uuid, date) from public, anon, authenticated;
revoke all on function public.friend_leaderboard(date) from public, anon, authenticated;
grant execute on function public.friend_leaderboard(date) to authenticated;
