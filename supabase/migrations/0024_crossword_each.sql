-- Coupled, migration 24: the crossword, solved separately.
--
-- Run once in the SQL Editor, after 0023.
--
-- Still one crossword a week for the couple — the same grid and clues for both of you —
-- but now you each fill in your own copy. Your letters are yours alone. What you see of
-- your partner's while you're solving is how far they've got (which squares they've
-- filled, never the letters) and whether they've finished; once you've finished too,
-- their whole grid, letters and all.
--
-- The grids started together before this keep what each of you typed: your letters go
-- into your copy, theirs into theirs.

create table public.crossword_fills (
  couple_id uuid not null,
  week date not null,
  user_id uuid not null, -- the person (see person(), 0013), not the device
  cells jsonb not null default '{}'::jsonb, -- "row,col" -> letter
  solved_at timestamptz,
  primary key (couple_id, week, user_id),
  foreign key (couple_id, week) references public.crosswords (couple_id, week) on delete cascade
);

alter table public.crossword_fills enable row level security;
-- No policies, on purpose: the only way in is the functions below.
revoke all on table public.crossword_fills from anon, authenticated;

-- Every square right? An empty square never is.
create function public.crossword_right(p_puzzle jsonb, p_cells jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(coalesce(p_cells ->> s.key = s.value, false)), false)
    from jsonb_each_text(p_puzzle -> 'solution') s
$$;
revoke all on function public.crossword_right(jsonb, jsonb) from public, anon, authenticated;

-- Each keeps the letters they typed in the shared grid.
insert into public.crossword_fills (couple_id, week, user_id, cells)
select c.couple_id, c.week, (e.value ->> 'by')::uuid, jsonb_object_agg(e.key, e.value ->> 'l')
  from public.crosswords c, jsonb_each(c.cells) e
 where e.value ->> 'by' ~ '^[0-9a-f-]{36}$'
 group by c.couple_id, c.week, e.value ->> 'by';

update public.crossword_fills f
   set solved_at = now()
  from public.crosswords c
 where c.couple_id = f.couple_id and c.week = f.week
   and public.crossword_right(c.puzzle, f.cells);

-- The shared letters now live in crossword_fills; the old column is left empty.
update public.crosswords set cells = '{}'::jsonb, solved_at = null;

-- Your partner in this couple, if there is one.
create function public.crossword_partner(p_couple uuid, p_me uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select user_id from public.members where couple_id = p_couple and user_id <> p_me limit 1
$$;
revoke all on function public.crossword_partner(uuid, uuid) from public, anon, authenticated;

-- The week's crossword as your phone sees it: the puzzle; your letters and when you
-- finished; and of your partner's, which squares they've filled and when they finished —
-- plus their letters, once you've finished yours. And the answers used in every other
-- week, so a new one doesn't repeat them. {state: 'none', used} if it isn't built yet.
create or replace function public.crossword(p_week date)
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
  cw public.crosswords;
  used jsonb;
  my_fill public.crossword_fills;
  their_fill public.crossword_fills;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  if mine is null then return jsonb_build_object('state', 'unpaired'); end if;
  them := public.crossword_partner(mine, me);

  select coalesce(jsonb_agg(distinct a), '[]'::jsonb) into used
    from public.crosswords c,
         jsonb_array_elements_text(coalesce(c.puzzle -> 'answers', '[]'::jsonb)) a
   where c.couple_id = mine and c.week <> p_week;

  select * into cw from public.crosswords where couple_id = mine and week = p_week;
  if not found then
    return jsonb_build_object('state', 'none', 'used', used);
  end if;

  select * into my_fill from public.crossword_fills where couple_id = mine and week = p_week and user_id = me;
  select * into their_fill from public.crossword_fills where couple_id = mine and week = p_week and user_id = them;

  return jsonb_build_object(
    'state', 'ready',
    'puzzle', cw.puzzle,
    'cells', coalesce(my_fill.cells, '{}'::jsonb),
    'solvedAt', my_fill.solved_at,
    'partner', jsonb_build_object(
      'filled', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(coalesce(their_fill.cells, '{}'::jsonb)) k),
      'solvedAt', their_fill.solved_at,
      'cells', case when my_fill.solved_at is not null then coalesce(their_fill.cells, '{}'::jsonb) end
    ),
    'used', used
  );
end;
$$;

-- Letters typed (or rubbed out, as an empty string) into your own grid, by square. Only
-- squares in the grid, only single letters A–Z. The moment every square's right it's
-- marked finished, and from then on it stays as it is.
create or replace function public.fill_crossword(p_week date, p_cells jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  cw public.crosswords;
  my_fill public.crossword_fills;
  next_cells jsonb;
  k text;
  v text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  if mine is null then raise exception 'not paired'; end if;
  select * into cw from public.crosswords where couple_id = mine and week = p_week;
  if not found then raise exception 'no crossword'; end if;
  if jsonb_typeof(p_cells) <> 'object' then raise exception 'bad letters'; end if;

  insert into public.crossword_fills (couple_id, week, user_id)
  values (mine, p_week, me)
  on conflict (couple_id, week, user_id) do nothing;
  select * into my_fill from public.crossword_fills
   where couple_id = mine and week = p_week and user_id = me for update;
  if my_fill.solved_at is not null then return public.crossword(p_week); end if;

  next_cells := my_fill.cells;
  for k, v in select key, value from jsonb_each_text(p_cells) loop
    if not (cw.puzzle -> 'solution') ? k then continue; end if;
    if v = '' then
      next_cells := next_cells - k;
    elsif v ~ '^[A-Z]$' then
      next_cells := next_cells || jsonb_build_object(k, v);
    end if;
  end loop;

  update public.crossword_fills
     set cells = next_cells,
         solved_at = case when public.crossword_right(cw.puzzle, next_cells) then now() end
   where couple_id = mine and week = p_week and user_id = me;
  return public.crossword(p_week);
end;
$$;

-- Every week's crossword, small: its shape, which squares each of you has filled (never
-- the letters), and when each of you finished. Newest first.
create or replace function public.crossword_weeks()
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
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  if mine is null then return '[]'::jsonb; end if;
  them := public.crossword_partner(mine, me);

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'week', c.week,
        'w', c.puzzle -> 'w',
        'h', c.puzzle -> 'h',
        'clues', jsonb_array_length(coalesce(c.puzzle -> 'entries', '[]'::jsonb)),
        'squares', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(c.puzzle -> 'solution') k),
        'mine', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(coalesce(f.cells, '{}'::jsonb)) k),
        'theirs', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(coalesce(t.cells, '{}'::jsonb)) k),
        'solvedAt', f.solved_at,
        'theirSolvedAt', t.solved_at
      )
      order by c.week desc
    )
    from public.crosswords c
    left join public.crossword_fills f on f.couple_id = c.couple_id and f.week = c.week and f.user_id = me
    left join public.crossword_fills t on t.couple_id = c.couple_id and t.week = c.week and t.user_id = them
    where c.couple_id = mine
  ), '[]'::jsonb);
end;
$$;
