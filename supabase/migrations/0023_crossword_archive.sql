-- Coupled, migration 23: every week's crossword, to look back on or finish.
--
-- Run once in the SQL Editor, after 0022.
--
-- A list of all your crosswords, newest first, with just enough to draw each one small
-- (the shape of the grid, and whose each filled square is — never the letters) and say
-- how far you got. Opening one uses crossword() and fill_crossword() from 0021, which
-- already take any week — so an old one can still be finished.
--
-- And the testing button's rebuild (0022) goes: a week's crossword now stays as built.

create function public.crossword_weeks()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  if mine is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'week', c.week,
        'w', c.puzzle -> 'w',
        'h', c.puzzle -> 'h',
        'clues', jsonb_array_length(coalesce(c.puzzle -> 'entries', '[]'::jsonb)),
        'squares', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(c.puzzle -> 'solution') k),
        'cells', coalesce((
          select jsonb_object_agg(key, (value ->> 'by') = me::text) from jsonb_each(c.cells)
        ), '{}'::jsonb),
        'solvedAt', c.solved_at
      )
      order by c.week desc
    )
    from public.crosswords c
    where c.couple_id = mine
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.crossword_weeks() from public, anon;
grant execute on function public.crossword_weeks() to authenticated;

drop function if exists public.reset_crossword(date);
