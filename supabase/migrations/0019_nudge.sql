-- Coupled, migration 19: nudging your partner into a game.
--
-- Run once in the SQL Editor, after 0018.
--
-- From a game's lobby, "Nudge them" leaves a note on the couple: who's waiting, in which
-- game, and since when. Your partner's app shows it on Home — "Johnny's waiting for you
-- in Tonight" with a button straight in — for a quarter of an hour, or until you're both
-- in. It's a note in the app, not a phone notification.

alter table public.couples add column waiting jsonb;

create function public.nudge(p_game text, p_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  if mine is null then raise exception 'not paired'; end if;
  if p_game is null or p_game !~ '^[a-z0-9]{2,12}$' or p_mode not in ('duo', 'screen') then
    raise exception 'no such game';
  end if;
  update public.couples
     set waiting = jsonb_build_object('by', me, 'game', p_game, 'mode', p_mode, 'at', now())
   where id = mine;
end;
$$;

-- Whoever's in the lobby clears it once you're both there.
create function public.clear_nudge()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine uuid;
begin
  if public.person() is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = public.person();
  update public.couples set waiting = null where id = mine;
end;
$$;

-- Your partner's nudge, if there's a fresh one — never your own.
create function public.nudged()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  w jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;
  select c.waiting into w
    from public.couples c
    join public.members m on m.couple_id = c.id
   where m.user_id = me;
  if w is null or (w ->> 'by')::uuid = me or (w ->> 'at')::timestamptz < now() - interval '15 minutes' then
    return null;
  end if;
  return jsonb_build_object(
    'game', w -> 'game',
    'mode', w -> 'mode',
    'at', w -> 'at',
    'from', (select name from public.members where user_id = (w ->> 'by')::uuid)
  );
end;
$$;

revoke all on function public.nudge(text, text) from public, anon, authenticated;
revoke all on function public.clear_nudge() from public, anon, authenticated;
revoke all on function public.nudged() from public, anon, authenticated;
grant execute on function public.nudge(text, text) to authenticated;
grant execute on function public.clear_nudge() to authenticated;
grant execute on function public.nudged() to authenticated;
