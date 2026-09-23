-- Couples Party, migration 4: a shared streak.
--
-- Run once in the SQL Editor, after 0003. Adds one function and extends daily()'s
-- output with a `streak` field; no tables change.
--
-- A day counts once you've both answered it — not solved, just answered, since that's
-- the part that's on you. The streak counts backward from today (today itself doesn't
-- count against you until the day's over): one missed day doesn't break it, but two in
-- a row do, right there.

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
   where couple_id = p_couple and kind = 'word' and for_date <= p_today;
  if first_day is null then return 0; end if;

  -- Two misses in a row end it, so a break more than sixty days back can't still be
  -- feeding the current streak — that just bounds the lookup on a couple who never miss.
  first_day := greatest(first_day, p_today - 59);
  span := p_today - first_day + 1;

  -- played[k] (1-based): did both of you answer day (first_day + k - 1)?
  played := array_fill(false, array[span]);
  for i in 0..span - 1 loop
    d := first_day + i;
    if (select count(distinct setter) from public.puzzles
         where couple_id = p_couple and kind = 'word' and for_date = d) = 2 then
      played[i + 1] := true;
    end if;
  end loop;

  i := span; -- today
  if not played[i] then i := i - 1; end if; -- today's not over yet — no penalty either way

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

-- Only ever called from inside daily(), same as wordle_pattern and puzzle_view — no
-- grant back to authenticated.
revoke all on function public.couple_streak(uuid, date) from public, anon, authenticated;

-- daily() now reports the streak alongside everything else.
create or replace function public.daily(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_row public.members;
  partner public.members;
  couple public.couples;
  mine public.puzzles;
  theirs public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single'); end if;

  select * into couple from public.couples where id = my_row.couple_id;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then
    return jsonb_build_object('state', 'waiting', 'code', couple.code, 'me', my_row.name);
  end if;

  select * into mine from public.puzzles where setter = me and for_date = p_today and kind = 'word';
  select * into theirs from public.puzzles where solver = me and for_date = p_today and kind = 'word';

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    -- The day's question, once either of you has answered it.
    'question', coalesce(mine.prompt, theirs.prompt),
    -- Yours: your answer, and how they're getting on with it.
    'mine', case when mine.id is not null then public.puzzle_view(mine, me) end,
    -- Theirs: hidden until you've answered.
    'theirs', case
      when theirs.id is null then null
      when mine.id is null then jsonb_build_object('locked', true)
      else public.puzzle_view(theirs, me)
    end,
    'streak', public.couple_streak(couple.id, p_today)
  );
end;
$$;
