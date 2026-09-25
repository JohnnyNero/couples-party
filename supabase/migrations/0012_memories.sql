-- Couples Party, migration 12: Memories.
--
-- Run once in the SQL Editor, after 0011.
--
-- The live games used to vanish when the night ended. Now each session you play as a
-- paired couple is kept: your Mr & Mrs answers, your drawings, your Wavelength clues,
-- the question you turned the light off on. Both phones save the same session as it
-- goes, so it's there even if you stop halfway, and either phone can save it.
--
-- memories() returns those sessions and your past daily puzzles together, for the
-- Memories tab. Past puzzles show their answers once the day is well over, even one
-- that was never solved.
--
-- Adds one table and two functions. Nothing else changes.

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  -- One row per live session, so both phones saving the same session is one memory.
  session_key text not null check (char_length(session_key) between 1 and 64),
  played_on date not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, session_key)
);
create index moments_couple_idx on public.moments (couple_id, played_on desc);

alter table public.moments enable row level security;
-- No policies, on purpose: the only way in is the two functions below.

-- Save (or update) this session for your couple. Called by both phones whenever a game
-- ends, with the whole session so far, so the latest save is always the fullest.
create function public.save_moment(p_session_key text, p_played_on date, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mine uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  if mine is null then raise exception 'not paired'; end if;
  if not exists (select 1 from public.members where couple_id = mine and user_id <> me) then
    raise exception 'not paired';
  end if;
  -- The phone's date, give or take a timezone.
  if p_played_on not between current_date - 2 and current_date + 2 then raise exception 'bad date'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'bad memory'; end if;
  if octet_length(p_payload::text) > 300000 then raise exception 'memory is too big'; end if;

  insert into public.moments (couple_id, session_key, played_on, payload)
  values (mine, p_session_key, p_played_on, p_payload)
  on conflict (couple_id, session_key)
  do update set payload = excluded.payload, updated_at = now();
end;
$$;

-- Everything for the Memories tab, a window of days at a time, newest first: the
-- sessions you played, and the daily puzzles from before today. `p_before` pages back
-- (the day after the oldest you've got); omit it for the latest.
create function public.memories(p_today date, p_before date default null, p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_row public.members;
  partner public.members;
  upto date := least(coalesce(p_before, p_today + 1), p_today + 1);
  since date := upto - greatest(1, least(coalesce(p_days, 30), 90));
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single'); end if;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then return jsonb_build_object('state', 'waiting'); end if;

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'since', since,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('key', m.session_key, 'playedOn', m.played_on, 'payload', m.payload)
                       order by m.played_on desc, m.created_at desc)
        from public.moments m
       where m.couple_id = my_row.couple_id and m.played_on >= since and m.played_on < upto
    ), '[]'::jsonb),
    -- Past days only: today's puzzles are still being played. Seen from the setter's
    -- side, so the answer shows — but only once the day is safely over on the server's
    -- clock too, whatever date the phone claims.
    'puzzles', coalesce((
      select jsonb_agg(
               public.any_view(p, p.setter) || jsonb_build_object('mine', p.setter = me)
               order by p.for_date desc, p.kind)
        from public.puzzles p
       where p.couple_id = my_row.couple_id
         and p.for_date >= since and p.for_date < upto
         and p.for_date < p_today
         and (p.status <> 'open' or p.for_date < current_date - 1)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.save_moment(text, date, jsonb) from public, anon, authenticated;
revoke all on function public.memories(date, date, int) from public, anon, authenticated;
grant execute on function public.save_moment(text, date, jsonb) to authenticated;
grant execute on function public.memories(date, date, int) to authenticated;
