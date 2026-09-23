-- Couples Party: pairing two phones, and the daily puzzle your partner sets for you.
--
-- Run this once, in full, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It's safe to run on an empty project; it doesn't touch anything else.
--
-- The security model is deliberately narrow. The tables have row level security on and
-- NO policies, so the public API can't read or write them at all. Everything goes
-- through the functions at the bottom, which check who's calling (auth.uid()) and only
-- ever touch that person's own couple. That's how a puzzle's answer stays hidden from
-- the person solving it until they've solved it: they never get to read the row, only
-- the function's view of it.

-- ---------------------------------------------------------------- tables

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  -- The join code while the first partner waits for the second; cleared once paired.
  code text unique,
  created_at timestamptz not null default now()
);

create table public.members (
  -- One couple per person. A person is an anonymous sign-in on one phone.
  user_id uuid primary key references auth.users (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  joined_at timestamptz not null default now()
);
create index members_couple_idx on public.members (couple_id);

create table public.puzzles (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  setter uuid not null references auth.users (id) on delete cascade,
  solver uuid not null references auth.users (id) on delete cascade,
  -- The day it's for, in the couple's own local calendar (the phone sends its date).
  for_date date not null,
  kind text not null check (kind in ('word')),
  prompt text not null check (char_length(prompt) between 1 and 120),
  answer text not null,
  guesses text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'solved', 'failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (setter, for_date, kind)
);
create index puzzles_solver_idx on public.puzzles (solver, for_date desc);

alter table public.couples enable row level security;
alter table public.members enable row level security;
alter table public.puzzles enable row level security;
-- No policies, on purpose — see the top of the file.

-- ---------------------------------------------------------------- helpers

-- The Wordle colouring for one guess: 'g' right letter right place, 'y' right letter
-- wrong place, '.' not in the word. Greens are taken first so a doubled letter in the
-- guess can't take a yellow that belongs to a green.
create function public.wordle_pattern(p_guess text, p_answer text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  counts int[] := array_fill(0, array[26]);
  result text[] := array['.', '.', '.', '.', '.'];
  g text;
  a text;
  idx int;
begin
  for i in 1..5 loop
    g := substr(p_guess, i, 1);
    a := substr(p_answer, i, 1);
    if g = a then
      result[i] := 'g';
    else
      idx := ascii(a) - 96;
      counts[idx] := counts[idx] + 1;
    end if;
  end loop;
  for i in 1..5 loop
    if result[i] <> 'g' then
      idx := ascii(substr(p_guess, i, 1)) - 96;
      if counts[idx] > 0 then
        result[i] := 'y';
        counts[idx] := counts[idx] - 1;
      end if;
    end if;
  end loop;
  return array_to_string(result, '');
end;
$$;

-- What the solver may see of a puzzle: everything but the answer, until it's over.
create function public.puzzle_view(p public.puzzles, p_viewer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'forDate', p.for_date,
    'kind', p.kind,
    'prompt', p.prompt,
    'guesses', to_jsonb(p.guesses),
    'patterns', coalesce(
      (select jsonb_agg(public.wordle_pattern(g, p.answer) order by n)
         from unnest(p.guesses) with ordinality as t(g, n)),
      '[]'::jsonb),
    'status', p.status,
    'answer', case when p.status <> 'open' or p_viewer = p.setter then p.answer end
  )
$$;

-- ---------------------------------------------------------------- pairing

-- Start a couple and get a code for your partner to type in. Calling it again while
-- still waiting hands back the same code rather than making a second couple.
create function public.create_couple(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  existing public.couples;
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I/L: read aloud safely
  new_code text;
  new_id uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'name required'; end if;

  select c.* into existing
    from public.couples c join public.members m on m.couple_id = c.id
   where m.user_id = me;
  if found then
    if existing.code is not null then return existing.code; end if;
    raise exception 'already paired';
  end if;

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.couples where code = new_code);
  end loop;

  insert into public.couples (code) values (new_code) returning id into new_id;
  insert into public.members (user_id, couple_id, name) values (me, new_id, left(trim(p_name), 24));
  return new_code;
end;
$$;

-- Join your partner's couple with the code they read out.
create function public.join_couple(p_code text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'name required'; end if;
  if exists (select 1 from public.members where user_id = me) then raise exception 'already paired'; end if;

  select id into target from public.couples where code = upper(trim(p_code)) for update;
  if not found then raise exception 'no such code'; end if;
  if (select count(*) from public.members where couple_id = target) <> 1 then
    raise exception 'no such code';
  end if;

  insert into public.members (user_id, couple_id, name) values (me, target, left(trim(p_name), 24));
  update public.couples set code = null where id = target;
end;
$$;

-- Unpair. The couple — and every puzzle in it — goes when its last member leaves.
create function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mine uuid;
begin
  delete from public.members where user_id = me returning couple_id into mine;
  if mine is not null and not exists (select 1 from public.members where couple_id = mine) then
    delete from public.couples where id = mine;
  end if;
end;
$$;

-- ---------------------------------------------------------------- the daily puzzle

-- Everything the Today screen needs, in one call. p_today is the phone's own date, so
-- "today" means the couple's today, not the server's.
create function public.daily(p_today date)
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
  to_solve public.puzzles;
  set_today public.puzzles;
  set_next public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single'); end if;

  select * into couple from public.couples where id = my_row.couple_id;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then
    return jsonb_build_object('state', 'waiting', 'code', couple.code, 'me', my_row.name);
  end if;

  -- The newest puzzle set for me that's due. An older one I never got to is skipped.
  select * into to_solve from public.puzzles
   where solver = me and for_date <= p_today order by for_date desc limit 1;
  -- The one I set for them today (to see how they're getting on)…
  select * into set_today from public.puzzles where setter = me and for_date = p_today;
  -- …and the one I've set for tomorrow.
  select * into set_next from public.puzzles where setter = me and for_date = p_today + 1;

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'toSolve', case when to_solve.id is not null then public.puzzle_view(to_solve, me) end,
    'setToday', case when set_today.id is not null then public.puzzle_view(set_today, me) end,
    'setNext', case when set_next.id is not null then public.puzzle_view(set_next, me) end
  );
end;
$$;

-- Set your partner's word for a day. You can change it until they've made a guess.
create function public.set_word(p_for_date date, p_prompt text, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mine uuid;
  them uuid;
  word text := lower(trim(p_answer));
  existing public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null then raise exception 'not paired'; end if;
  if word !~ '^[a-z]{5}$' then raise exception 'five letters, a to z'; end if;
  -- The phone's date, give or take a timezone — not a way to fill next month in advance.
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'word';
  if found then
    if cardinality(existing.guesses) > 0 then raise exception 'they have already started it'; end if;
    update public.puzzles set prompt = p_prompt, answer = word where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer)
    values (mine, me, them, p_for_date, 'word', p_prompt, word);
  end if;
end;
$$;

-- One guess at the puzzle set for you. Scored here, so the answer never has to reach
-- your phone until you're done.
create function public.submit_guess(p_puzzle uuid, p_guess text)
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
  if word !~ '^[a-z]{5}$' then raise exception 'five letters, a to z'; end if;

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

-- ---------------------------------------------------------------- who may call what

-- Supabase grants every new function to anon and authenticated by default, so revoking
-- from PUBLIC alone isn't enough: take everything away from everyone, then hand back
-- exactly the six calls the app makes, to signed-in users only.
revoke all on function public.wordle_pattern(text, text) from public, anon, authenticated;
revoke all on function public.puzzle_view(public.puzzles, uuid) from public, anon, authenticated;
revoke all on function public.create_couple(text) from public, anon, authenticated;
revoke all on function public.join_couple(text, text) from public, anon, authenticated;
revoke all on function public.leave_couple() from public, anon, authenticated;
revoke all on function public.daily(date) from public, anon, authenticated;
revoke all on function public.set_word(date, text, text) from public, anon, authenticated;
revoke all on function public.submit_guess(uuid, text) from public, anon, authenticated;

grant execute on function public.create_couple(text) to authenticated;
grant execute on function public.join_couple(text, text) to authenticated;
grant execute on function public.leave_couple() to authenticated;
grant execute on function public.daily(date) to authenticated;
grant execute on function public.set_word(date, text, text) to authenticated;
grant execute on function public.submit_guess(uuid, text) to authenticated;
