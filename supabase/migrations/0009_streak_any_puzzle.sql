-- Couples Party, migration 9: the streak counts whichever puzzle the day was.
--
-- Run once in the SQL Editor, after 0008.
--
-- The Today tab now shows one daily puzzle, rotating through all five kinds, so a day
-- counts for the streak once you've both answered that day's puzzle — whatever kind it
-- was — not only on Their Word days. Same rule otherwise: one missed day doesn't break
-- it, two in a row do, and today isn't held against you until it's over.
--
-- Also adds streak(), so the card can show it whichever puzzle is up. No tables change.

create or replace function public.couple_streak(p_couple uuid, p_today date)
returns int
language plpgsql
stable
set search_path = ''
as $$
declare
  first_day date;
  span int;
  played bool[];
  i int;
  streak int := 0;
  consecutive_misses int := 0;
  d date;
begin
  select min(for_date) into first_day
    from public.puzzles
   where couple_id = p_couple and for_date <= p_today;
  if first_day is null then return 0; end if;

  first_day := greatest(first_day, p_today - 59);
  span := p_today - first_day + 1;

  -- played[k] (1-based): did both of you answer the same puzzle on day (first_day + k - 1)?
  played := array_fill(false, array[span]);
  for i in 0..span - 1 loop
    d := first_day + i;
    if exists (
      select 1 from public.puzzles
       where couple_id = p_couple and for_date = d
       group by kind
      having count(distinct setter) = 2
    ) then
      played[i + 1] := true;
    end if;
  end loop;

  i := span;
  if not played[i] then i := i - 1; end if;

  while i >= 1 loop
    if played[i] then
      streak := streak + 1;
      consecutive_misses := 0;
    else
      consecutive_misses := consecutive_misses + 1;
      if consecutive_misses >= 2 then exit; end if;
    end if;
    i := i - 1;
  end loop;

  return streak;
end;
$$;
-- (Replacing a function keeps its permissions — still internal only.)

-- The couple's streak on its own, for whichever puzzle card is showing. 0 if unpaired.
create function public.streak(p_today date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = auth.uid();
  if mine is null then return 0; end if;
  return public.couple_streak(mine, p_today);
end;
$$;

revoke all on function public.streak(date) from public, anon, authenticated;
grant execute on function public.streak(date) to authenticated;
