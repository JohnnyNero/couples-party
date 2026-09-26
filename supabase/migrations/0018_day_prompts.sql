-- Coupled, migration 18: the day's questions, before you set yours.
--
-- Run once in the SQL Editor, after 0017.
--
-- Every set_* function already pins a day's question to whichever of you set first —
-- so if the second of you had been shown a different one (Our questions changed, the
-- content file was updated), their answer was quietly filed under the first's question.
-- Now the app asks first: day_prompts() says which question your partner already set
-- for that day, kind by kind, and the set screen shows that one. Never their answers.

create function public.day_prompts(p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  them uuid;
  out jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null or p_date not between current_date - 2 and current_date + 3 then
    return '{}'::jsonb;
  end if;

  select jsonb_object_agg(p.kind, jsonb_strip_nulls(jsonb_build_object(
           'prompt', p.prompt,
           'items', p.payload -> 'items',        -- Top 5: the five, in the day's order
           'questions', p.payload -> 'questions' -- Their Numbers, This or That
         )))
    into out
    from public.puzzles p
   where p.setter = them and p.for_date = p_date;
  return coalesce(out, '{}'::jsonb);
end;
$$;

revoke all on function public.day_prompts(date) from public, anon, authenticated;
grant execute on function public.day_prompts(date) to authenticated;
