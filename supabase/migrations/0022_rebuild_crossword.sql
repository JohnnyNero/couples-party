-- Coupled, migration 22: rebuilding this week's crossword (for testing).
--
-- Run once in the SQL Editor, after 0021.
--
-- The first crossword saved for a week is the one that stands (see 0021), so trying the
-- builder again needs this week's cleared first. Only your own couple's, only this week
-- or last; your letters in it go too.

create function public.reset_crossword(p_week date)
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
  if p_week > current_date + 1 or p_week < current_date - 14 then raise exception 'not this week'; end if;
  delete from public.crosswords where couple_id = mine and week = p_week;
end;
$$;

revoke all on function public.reset_crossword(date) from public, anon;
grant execute on function public.reset_crossword(date) to authenticated;
