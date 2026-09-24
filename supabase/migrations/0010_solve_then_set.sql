-- Couples Party, migration 10: solve theirs, then set tomorrow's — and a scoreboard.
--
-- Run once in the SQL Editor, after 0009. No tables change.
--
-- The Today tab now shows all five daily puzzles at once. For each, you solve the one
-- your partner set for you for today, then set one for them for tomorrow. So:
--
-- - The "answer yours first" lock is gone. The puzzle you're solving was set yesterday,
--   and nothing you set today can be swayed by it — it's for tomorrow.
-- - Every finished puzzle is worth points to whoever solved it, out of 10 per puzzle:
--   Their Word 10/8/6/4/3/2 by guesses, The Dial 10 for a bullseye / 7 within 5 / 4
--   within 15, Top 5 and Their Numbers 2 per exact and 1 per close, Sketch 10/6/3 by
--   guesses. Scores are worked out from the puzzles, never stored.
-- - The streak counts a day once you've both done something that day: solved one of
--   that day's puzzles, or set one for the next.
-- - board() returns the whole Today screen — every kind, the scores, the streak — in
--   one call.

-- ---------------------------------------------------------------- no more lock
create or replace function public.submit_guess(p_puzzle uuid, p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p public.puzzles;
  word text := lower(trim(p_guess));
begin
  select * into p from public.puzzles where id = p_puzzle for update;
  if not found or p.solver <> me then raise exception 'no such puzzle'; end if;
  if p.status <> 'open' then return public.puzzle_view(p, me); end if;
  -- A guess is the same length as the answer — the solver's grid already shows which.
  if word !~ '^[a-z]+$' or char_length(word) <> char_length(p.answer) then
    raise exception '% letters, a to z', case char_length(p.answer) when 6 then 'six' else 'five' end;
  end if;

  p.guesses := p.guesses || word;
  if word = p.answer then
    p.status := 'solved';
  elsif cardinality(p.guesses) >= 6 then
    p.status := 'failed';
  end if;
  update public.puzzles
     set guesses = p.guesses,
         status = p.status,
         finished_at = case when p.status <> 'open' then now() end
   where id = p.id;
  return public.puzzle_view(p, me);
end;
$$;

create or replace function public.submit_dial(p_puzzle uuid, p_guess int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p public.puzzles;
begin
  select * into p from public.puzzles where id = p_puzzle for update;
  if not found or p.solver <> me then raise exception 'no such puzzle'; end if;
  if p.status <> 'open' then return public.dial_view(p, me); end if;
  if p_guess < 0 or p_guess > 100 then raise exception 'guess out of range'; end if;

  update public.puzzles
     set progress = jsonb_build_object('guess', p_guess, 'distance', abs((p.payload ->> 'target')::int - p_guess)),
         status = 'solved',
         finished_at = now()
   where id = p.id;
  return public.dial_view((select pz from public.puzzles pz where pz.id = p.id), me);
end;
$$;

create or replace function public.submit_top5(p_puzzle uuid, p_guess int[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p public.puzzles;
  rank int[];
  exact_n int := 0;
  near_n int := 0;
  gap int;
  i int;
begin
  select * into p from public.puzzles where id = p_puzzle for update;
  if not found or p.solver <> me then raise exception 'no such puzzle'; end if;
  if p.status <> 'open' then return public.top5_view(p, me); end if;
  if not public.is_top5_order(p_guess) then raise exception 'that is not a ranking of all five'; end if;

  rank := array(select jsonb_array_elements_text(p.payload -> 'rank'))::int[];
  for i in 0..4 loop
    gap := abs(array_position(rank, i) - array_position(p_guess, i));
    if gap = 0 then exact_n := exact_n + 1;
    elsif gap = 1 then near_n := near_n + 1;
    end if;
  end loop;

  update public.puzzles
     set progress = jsonb_build_object('guess', to_jsonb(p_guess), 'exact', exact_n, 'near', near_n),
         status = 'solved',
         finished_at = now()
   where id = p.id;
  return public.top5_view((select pz from public.puzzles pz where pz.id = p.id), me);
end;
$$;

create or replace function public.submit_sketch(p_puzzle uuid, p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p public.puzzles;
  guess text := trim(p_guess);
  tries jsonb;
begin
  select * into p from public.puzzles where id = p_puzzle for update;
  if not found or p.solver <> me then raise exception 'no such puzzle'; end if;
  if p.status <> 'open' then return public.sketch_view(p, me); end if;
  if char_length(guess) < 1 or char_length(guess) > 30 or public.sketch_norm(guess) = '' then
    raise exception 'answer must be 1 to 30 characters';
  end if;

  tries := coalesce(p.progress -> 'guesses', '[]'::jsonb) || to_jsonb(guess);
  update public.puzzles
     set progress = jsonb_build_object('guesses', tries),
         status = case
           when public.sketch_norm(guess) = public.sketch_norm(p.payload ->> 'answer') then 'solved'
           when jsonb_array_length(tries) >= 3 then 'failed'
           else 'open'
         end,
         finished_at = case
           when public.sketch_norm(guess) = public.sketch_norm(p.payload ->> 'answer')
             or jsonb_array_length(tries) >= 3 then now()
         end
   where id = p.id;
  return public.sketch_view((select pz from public.puzzles pz where pz.id = p.id), me);
end;
$$;

create or replace function public.submit_numbers(p_puzzle uuid, p_guesses int[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p public.puzzles;
  answers int[];
  marks text[];
begin
  select * into p from public.puzzles where id = p_puzzle for update;
  if not found or p.solver <> me then raise exception 'no such puzzle'; end if;
  if p.status <> 'open' then return public.numbers_view(p, me); end if;
  if not public.is_five_numbers(p_guesses) then raise exception 'five whole numbers, 0 to 9999'; end if;

  answers := array(select jsonb_array_elements_text(p.payload -> 'answers'))::int[];
  marks := array(select public.numbers_mark(p_guesses[i], answers[i]) from generate_series(1, 5) i order by i);

  update public.puzzles
     set progress = jsonb_build_object('guesses', to_jsonb(p_guesses), 'marks', to_jsonb(marks)),
         status = 'solved',
         finished_at = now()
   where id = p.id;
  return public.numbers_view((select pz from public.puzzles pz where pz.id = p.id), me);
end;
$$;

-- ---------------------------------------------------------------- points

create function public.puzzle_points(p public.puzzles)
returns int
language sql
stable
set search_path = ''
as $$
  select case
    when p.status = 'open' then 0
    when p.kind = 'word' then
      case when p.status <> 'solved' then 0
           else (array[10, 8, 6, 4, 3, 2])[least(cardinality(p.guesses), 6)] end
    when p.kind = 'dial' then
      case when (p.progress ->> 'distance')::int = 0 then 10
           when (p.progress ->> 'distance')::int <= 5 then 7
           when (p.progress ->> 'distance')::int <= 15 then 4
           else 0 end
    when p.kind = 'top5' then 2 * (p.progress ->> 'exact')::int + (p.progress ->> 'near')::int
    when p.kind = 'sketch' then
      case when p.status <> 'solved' then 0
           else (array[10, 6, 3])[least(jsonb_array_length(p.progress -> 'guesses'), 3)] end
    when p.kind = 'numbers' then
      (select coalesce(sum(case m when 'exact' then 2 when 'close' then 1 else 0 end), 0)::int
         from jsonb_array_elements_text(p.progress -> 'marks') m)
    else 0
  end
$$;
revoke all on function public.puzzle_points(public.puzzles) from public, anon, authenticated;

-- Any kind's view, plus the points it earned once it's finished.
create function public.any_view(p public.puzzles, p_viewer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select (case p.kind
    when 'word' then public.puzzle_view(p, p_viewer)
    when 'dial' then public.dial_view(p, p_viewer)
    when 'top5' then public.top5_view(p, p_viewer)
    when 'sketch' then public.sketch_view(p, p_viewer)
    when 'numbers' then public.numbers_view(p, p_viewer)
  end) || jsonb_build_object('points', case when p.status <> 'open' then public.puzzle_points(p) end)
$$;
revoke all on function public.any_view(public.puzzles, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- streak

-- A day counts once you've both done something on it: solved one of that day's
-- puzzles, or set one for the next day. One missed day is forgiven; two in a row end it.
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
  select min(for_date) - 1 into first_day
    from public.puzzles
   where couple_id = p_couple and for_date <= p_today + 1;
  if first_day is null then return 0; end if;

  first_day := greatest(first_day, p_today - 59);
  span := p_today - first_day + 1;
  if span < 1 then return 0; end if;

  played := array_fill(false, array[span]);
  for i in 0..span - 1 loop
    d := first_day + i;
    if (select count(distinct who) from (
          select solver as who from public.puzzles
           where couple_id = p_couple and for_date = d and status <> 'open'
          union
          select setter from public.puzzles
           where couple_id = p_couple and for_date = d + 1
        ) t) = 2 then
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

-- ---------------------------------------------------------------- the board

-- The whole Today screen in one call. For each kind: `solve` is theirs for you today,
-- `mine` is yours for them today (how they're getting on), `next` is what you've set
-- them for tomorrow. Plus today's and all-time points each, and the streak.
create function public.board(p_today date)
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
  k text;
  kinds jsonb := '{}'::jsonb;
  s public.puzzles;
  m public.puzzles;
  n public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single'); end if;

  select * into couple from public.couples where id = my_row.couple_id;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then
    return jsonb_build_object('state', 'waiting', 'code', couple.code, 'me', my_row.name);
  end if;

  foreach k in array array['word', 'dial', 'top5', 'sketch', 'numbers'] loop
    select * into s from public.puzzles where solver = me and for_date = p_today and kind = k;
    select * into m from public.puzzles where setter = me and for_date = p_today and kind = k;
    select * into n from public.puzzles where setter = me and for_date = p_today + 1 and kind = k;
    kinds := kinds || jsonb_build_object(k, jsonb_build_object(
      'solve', case when s.id is not null then public.any_view(s, me) end,
      'mine', case when m.id is not null then public.any_view(m, me) end,
      'next', case when n.id is not null then public.any_view(n, me) end
    ));
  end loop;

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'kinds', kinds,
    'today', jsonb_build_object(
      'me', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = couple.id and p.solver = me and p.for_date = p_today),
      'them', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = couple.id and p.solver = partner.user_id and p.for_date = p_today)),
    'total', jsonb_build_object(
      'me', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = couple.id and p.solver = me),
      'them', (select coalesce(sum(public.puzzle_points(p)), 0) from public.puzzles p
              where p.couple_id = couple.id and p.solver = partner.user_id)),
    'streak', public.couple_streak(couple.id, p_today)
  );
end;
$$;

revoke all on function public.board(date) from public, anon, authenticated;
grant execute on function public.board(date) to authenticated;
