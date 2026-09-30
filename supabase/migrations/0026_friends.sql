-- Coupled, migration 26: friend couples.
--
-- Run once in the SQL Editor, after 0025.
--
-- Two couples can be friends. Each couple has a friend code (and so a link) that either
-- of them can share; the other couple opens it, sees who it is, and adds them. Friends
-- see a little of each other — never answers, puzzles or Memories, just:
--   · both names and photos
--   · the streak
--   · whether they've played Today's games today, and their team score if so
--   · how many of today's puzzles they've solved
--
-- Friendships are between couples, not people, and go when either couple does (unpairing,
-- deleting an account). A couple can have up to 100 friends.

alter table public.couples add column friend_code text unique;

create table public.friendships (
  a uuid not null references public.couples (id) on delete cascade,
  b uuid not null references public.couples (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b) -- each pair once, the smaller id first
);
create index friendships_b_idx on public.friendships (b);

alter table public.friendships enable row level security;
-- No policies, on purpose: the only way in is the functions below.
revoke all on table public.friendships from anon, authenticated;

-- A code nobody can guess: eight characters from the same easy-to-read alphabet as the
-- pairing codes, drawn from gen_random_uuid()'s strong randomness (skipping the two bytes
-- that carry its version and variant) rather than random().
create function public.fresh_code(p_len int)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  picks int[] := array[0,1,2,3,4,5,7,9,10,11,12,13,14,15,16,17,18,19,20,21,23,25,26,27,28,29,30,31];
  out text := '';
begin
  for i in 1..least(p_len, array_length(picks, 1)) loop
    out := out || substr(alphabet, 1 + get_byte(bytes, picks[i]) % length(alphabet), 1);
  end loop;
  return out;
end;
$$;

-- The caller's couple, if it's a whole one (both of you paired). Friends need both.
create function public.my_pair()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.couple_id from public.members m
   where m.user_id = public.person()
     and (select count(*) from public.members o where o.couple_id = m.couple_id) = 2
$$;

-- What a friend sees of a couple (see the top of this file).
create function public.friend_card(p_couple uuid, p_today date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_couple,
    'members', coalesce((select jsonb_agg(jsonb_build_object('name', m.name, 'photo', m.photo) order by m.joined_at)
                           from public.members m where m.couple_id = p_couple), '[]'::jsonb),
    'streak', public.couple_streak(p_couple, p_today),
    'today', (select jsonb_build_object('team', max((mo.payload ->> 'team')::numeric),
                                        'finished', bool_or(coalesce((mo.payload ->> 'finished')::boolean, false)))
                from public.moments mo
               where mo.couple_id = p_couple and mo.played_on = p_today and mo.payload ->> 'game' = 'tonight'
              having count(*) > 0),
    'puzzles', (select count(*) from public.puzzles p
                 where p.couple_id = p_couple and p.for_date = p_today and p.status <> 'open')
  )
$$;

-- Your couple's friend code (made the first time it's asked for).
create function public.friend_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine uuid := public.my_pair();
  fc text;
begin
  if public.person() is null then raise exception 'not signed in'; end if;
  if mine is null then raise exception 'pair first'; end if;
  select friend_code into fc from public.couples where id = mine;
  if fc is not null then return fc; end if;
  loop
    fc := public.fresh_code(8);
    exit when not exists (select 1 from public.couples where friend_code = fc);
  end loop;
  update public.couples set friend_code = fc where id = mine;
  return fc;
end;
$$;

-- A new code, so the old link stops working (friends you've made stay friends).
create function public.new_friend_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine uuid := public.my_pair();
begin
  if public.person() is null then raise exception 'not signed in'; end if;
  if mine is null then raise exception 'pair first'; end if;
  update public.couples set friend_code = null where id = mine;
  return public.friend_code();
end;
$$;

-- Who a code belongs to, before you add them: their names and photos, and whether
-- they're you or already your friends.
create function public.friend_preview(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mine uuid := public.my_pair();
  theirs uuid;
begin
  if public.person() is null then raise exception 'not signed in'; end if;
  select id into theirs from public.couples where friend_code = upper(btrim(coalesce(p_code, '')));
  if theirs is null then raise exception 'no such code'; end if;
  return jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object('name', m.name, 'photo', m.photo) order by m.joined_at)
                           from public.members m where m.couple_id = theirs), '[]'::jsonb),
    'you', theirs = mine,
    'friends', exists (select 1 from public.friendships where a = least(mine, theirs) and b = greatest(mine, theirs))
  );
end;
$$;

create function public.add_friend(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine uuid := public.my_pair();
  theirs uuid;
begin
  if public.person() is null then raise exception 'not signed in'; end if;
  if mine is null then raise exception 'pair first'; end if;
  select id into theirs from public.couples where friend_code = upper(btrim(coalesce(p_code, '')));
  if theirs is null then raise exception 'no such code'; end if;
  if theirs = mine then raise exception 'that is you'; end if;
  if (select count(*) from public.members where couple_id = theirs) <> 2 then raise exception 'no such code'; end if;
  if (select count(*) from public.friendships where a = mine or b = mine) >= 100 then raise exception 'too many friends'; end if;
  insert into public.friendships (a, b) values (least(mine, theirs), greatest(mine, theirs)) on conflict do nothing;
end;
$$;

create function public.remove_friend(p_couple uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine uuid := public.my_pair();
begin
  if public.person() is null then raise exception 'not signed in'; end if;
  if mine is null then return; end if;
  delete from public.friendships where a = least(mine, p_couple) and b = greatest(mine, p_couple);
end;
$$;

-- Your friends, as they are today (p_today is your date, as everywhere else).
create function public.friends(p_today date)
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
    select jsonb_agg(public.friend_card(f.other, p_today) || jsonb_build_object('since', f.created_at) order by f.created_at)
      from (select case when a = mine then b else a end as other, created_at
              from public.friendships where a = mine or b = mine) f
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.fresh_code(int) from public, anon, authenticated;
revoke all on function public.my_pair() from public, anon, authenticated;
revoke all on function public.friend_card(uuid, date) from public, anon, authenticated;
revoke all on function public.friend_code() from public, anon, authenticated;
revoke all on function public.new_friend_code() from public, anon, authenticated;
revoke all on function public.friend_preview(text) from public, anon, authenticated;
revoke all on function public.add_friend(text) from public, anon, authenticated;
revoke all on function public.remove_friend(uuid) from public, anon, authenticated;
revoke all on function public.friends(date) from public, anon, authenticated;
grant execute on function public.friend_code() to authenticated;
grant execute on function public.new_friend_code() to authenticated;
grant execute on function public.friend_preview(text) to authenticated;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.friends(date) to authenticated;
