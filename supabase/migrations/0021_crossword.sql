-- Coupled, migration 21: our crossword.
--
-- Run once in the SQL Editor, after 0020.
--
-- A crossword a week, built from things the two of you have said — your answers from
-- the daily puzzles and the games — topped up with general knowledge. It's one grid for
-- the couple: you both fill it in, in your own time, and see each other's letters.
--
-- The app builds the puzzle (it has your answers to hand); the first phone to open the
-- week's crossword saves it and every other open gets that same one. Letters are kept
-- per square, with whose they are; the last letter typed in a square is the one that
-- stays. Once every square is right, it's marked solved.

create table public.crosswords (
  couple_id uuid not null references public.couples (id) on delete cascade,
  week date not null, -- the Monday of the week it's for
  puzzle jsonb not null, -- the grid, the clues, and the answer in each square
  cells jsonb not null default '{}'::jsonb, -- "row,col" -> {"l": letter, "by": person}
  solved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (couple_id, week)
);

alter table public.crosswords enable row level security;
-- No policies, on purpose: the only way in is the functions below.
revoke all on table public.crosswords from anon, authenticated;

-- The week's crossword as the app sees it: the puzzle, every letter in it (and whether
-- it's yours), when it was solved — and the answers used in every other week, so a new
-- one doesn't repeat them. {state: 'none', used} if this week's isn't built yet.
create function public.crossword(p_week date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  cw public.crosswords;
  used jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  if mine is null then return jsonb_build_object('state', 'unpaired'); end if;

  select coalesce(jsonb_agg(distinct a), '[]'::jsonb) into used
    from public.crosswords c,
         jsonb_array_elements_text(coalesce(c.puzzle -> 'answers', '[]'::jsonb)) a
   where c.couple_id = mine and c.week <> p_week;

  select * into cw from public.crosswords where couple_id = mine and week = p_week;
  if not found then
    return jsonb_build_object('state', 'none', 'used', used);
  end if;

  return jsonb_build_object(
    'state', 'ready',
    'puzzle', cw.puzzle,
    'cells', coalesce((
      select jsonb_object_agg(key, jsonb_build_object('l', value ->> 'l', 'mine', (value ->> 'by') = me::text))
        from jsonb_each(cw.cells)
    ), '{}'::jsonb),
    'solvedAt', cw.solved_at,
    'used', used
  );
end;
$$;

-- Saves the week's crossword if nobody has yet; either way, returns the one that stands.
create function public.start_crossword(p_week date, p_puzzle jsonb)
returns jsonb
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
  if extract(isodow from p_week) <> 1 or p_week > current_date + 1 or p_week < current_date - 14 then
    raise exception 'not this week';
  end if;
  if p_puzzle is null or coalesce(jsonb_typeof(p_puzzle -> 'solution'), '') <> 'object' or length(p_puzzle::text) > 30000 then
    raise exception 'not a crossword';
  end if;
  insert into public.crosswords (couple_id, week, puzzle)
  values (mine, p_week, p_puzzle)
  on conflict (couple_id, week) do nothing;
  return public.crossword(p_week);
end;
$$;

-- Letters typed (or rubbed out, as an empty string), by square. Only squares that are
-- in the grid, only single letters A–Z. Marks it solved the moment every square is right.
create function public.fill_crossword(p_week date, p_cells jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  cw public.crosswords;
  next_cells jsonb;
  k text;
  v text;
  right_now boolean;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  if mine is null then raise exception 'not paired'; end if;
  select * into cw from public.crosswords where couple_id = mine and week = p_week for update;
  if not found then raise exception 'no crossword'; end if;
  if jsonb_typeof(p_cells) <> 'object' then raise exception 'bad letters'; end if;

  next_cells := cw.cells;
  for k, v in select key, value from jsonb_each_text(p_cells) loop
    if not (cw.puzzle -> 'solution') ? k then continue; end if;
    if v = '' then
      next_cells := next_cells - k;
    elsif v ~ '^[A-Z]$' then
      next_cells := next_cells || jsonb_build_object(k, jsonb_build_object('l', v, 'by', me));
    end if;
  end loop;

  -- An empty square is never right (a plain comparison with nothing would just be skipped).
  select bool_and(coalesce(next_cells -> s.key ->> 'l' = s.value, false)) into right_now
    from jsonb_each_text(cw.puzzle -> 'solution') s;

  update public.crosswords
     set cells = next_cells,
         solved_at = case when cw.solved_at is null and coalesce(right_now, false) then now() else cw.solved_at end
   where couple_id = mine and week = p_week;
  return public.crossword(p_week);
end;
$$;

revoke all on function public.crossword(date) from public, anon;
revoke all on function public.start_crossword(date, jsonb) from public, anon;
revoke all on function public.fill_crossword(date, jsonb) from public, anon;
grant execute on function public.crossword(date) to authenticated;
grant execute on function public.start_crossword(date, jsonb) to authenticated;
grant execute on function public.fill_crossword(date, jsonb) to authenticated;
