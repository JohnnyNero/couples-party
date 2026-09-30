-- Coupled, migration 25: real accounts.
--
-- Run once in the SQL Editor, after 0024.
--
-- You can now sign in — an email code, or Google — and any phone you sign in on is you.
-- That's done by Supabase Auth itself (a guest's anonymous account is given an email, so
-- it becomes a real one without anything moving), so nothing here changes how the rest
-- of the database knows who you are: every function still asks public.person().
--
-- What goes is 0015's way of making a second device you — a short code typed into the
-- other phone — since signing in does it properly now: link_code(), link_device(),
-- unlink_device() and the table of codes. A device that was linked that way before
-- keeps working exactly as it did (public.devices and public.person() stay).
--
-- What comes is deleting your account: you, the devices linked to you, and your couple
-- — which, like unpairing, is both of you: your puzzles, streak and Memories go too.

drop function if exists public.link_code();
drop function if exists public.link_device(text);
drop function if exists public.unlink_device();
drop table if exists public.device_codes;

create function public.delete_account()
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
  if mine is not null then
    delete from public.couples where id = mine; -- members, puzzles, moments, ideas, crosswords with it
  end if;
  -- You, on every device: the ones linked to you, the one calling, and you yourself.
  delete from auth.users where id in (select alias from public.devices where person = me);
  delete from auth.users where id in (me, auth.uid());
end;
$$;

revoke all on function public.delete_account() from public, anon, authenticated;
grant execute on function public.delete_account() to authenticated;
