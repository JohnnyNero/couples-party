-- Coupled, migration 15: one of you, more than one device.
--
-- Run once in the SQL Editor, after 0014.
--
-- Until now a person WAS a phone: each phone signs in anonymously, and that sign-in is
-- who you are. Now a second device can be linked to you: Profile → "Add another
-- device" gives a short code (good for 15 minutes, once); type it into "I have a code"
-- on the other device, or open its link, and that device is you too — same couple, same
-- puzzles, same Memories.
--
-- How: a small table maps a linked device's sign-in to the person it belongs to, and
-- public.person() answers "who is this?" (the person, for a linked device; the sign-in
-- itself otherwise). Every function that used auth.uid() to mean "who's calling" is
-- re-issued below, unchanged except that it now asks public.person() — they're copied
-- from their latest version in the earlier migrations.
--
-- Adds two tables and four functions, and re-issues 29 functions.

create table public.devices (
  -- A linked device's own anonymous sign-in…
  alias uuid primary key references auth.users (id) on delete cascade,
  -- …and the person it acts as.
  person uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index devices_person_idx on public.devices (person);

create table public.device_codes (
  code text primary key,
  person uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.devices enable row level security;
alter table public.device_codes enable row level security;
-- No policies, on purpose: the only way in is the functions below.

-- Who's calling: the person a linked device belongs to, or the sign-in itself.
create function public.person()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select d.person from public.devices d where d.alias = auth.uid()), auth.uid())
$$;
revoke all on function public.person() from public, anon, authenticated;

-- ---------------------------------------------------------------- re-issued

-- create_couple(text), as of 0011_couple_room_code.sql
create or replace function public.create_couple(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  existing public.couples;
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I/L: read aloud safely
  new_code text;
  new_room text;
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

  loop
    new_room := '';
    for i in 1..10 loop
      new_room := new_room || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.couples where room_code = new_room);
  end loop;

  insert into public.couples (code, room_code) values (new_code, new_room) returning id into new_id;
  insert into public.members (user_id, couple_id, name) values (me, new_id, left(trim(p_name), 24));
  return new_code;
end;
$$;

-- join_couple(text,text), as of 0001_pairing_and_daily.sql
create or replace function public.join_couple(p_code text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

-- leave_couple(), as of 0013_profile.sql
create or replace function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
begin
  select couple_id into mine from public.members where user_id = me;
  if mine is not null then
    delete from public.couples where id = mine;
  end if;
end;
$$;

-- daily(date), as of 0004_streak.sql
create or replace function public.daily(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

-- set_word(date,text,text), as of 0003_five_or_six_letters.sql
create or replace function public.set_word(p_for_date date, p_prompt text, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  them uuid;
  word text := lower(trim(p_answer));
  question text := p_prompt;
  existing public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null then raise exception 'not paired'; end if;
  if word !~ '^[a-z]{5,6}$' then raise exception 'five or six letters, a to z'; end if;
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select prompt into question from public.puzzles
   where setter = them and for_date = p_for_date and kind = 'word';
  question := coalesce(question, p_prompt);

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'word';
  if found then
    if cardinality(existing.guesses) > 0 then raise exception 'they have already started it'; end if;
    update public.puzzles set prompt = question, answer = word where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer)
    values (mine, me, them, p_for_date, 'word', question, word);
  end if;
end;
$$;

-- submit_guess(uuid,text), as of 0010_solve_then_set.sql
create or replace function public.submit_guess(p_puzzle uuid, p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

-- set_dial(date,text,int,text), as of 0005_the_dial.sql
create or replace function public.set_dial(p_for_date date, p_prompt text, p_target int, p_clue text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  them uuid;
  clue text := trim(p_clue);
  spectrum text := p_prompt;
  existing public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null then raise exception 'not paired'; end if;
  if p_target < 0 or p_target > 100 then raise exception 'target out of range'; end if;
  if char_length(clue) < 1 or char_length(clue) > 40 then raise exception 'clue must be 1 to 40 characters'; end if;
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select prompt into spectrum from public.puzzles
   where setter = them and for_date = p_for_date and kind = 'dial';
  spectrum := coalesce(spectrum, p_prompt);

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'dial';
  if found then
    if existing.progress is not null then raise exception 'they have already started it'; end if;
    update public.puzzles
       set prompt = spectrum, payload = jsonb_build_object('target', p_target, 'clue', clue)
     where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, payload)
    values (mine, me, them, p_for_date, 'dial', spectrum, '', jsonb_build_object('target', p_target, 'clue', clue));
  end if;
end;
$$;

-- submit_dial(uuid,int), as of 0010_solve_then_set.sql
create or replace function public.submit_dial(p_puzzle uuid, p_guess int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

-- daily_dial(date), as of 0005_the_dial.sql
create or replace function public.daily_dial(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

  select * into mine from public.puzzles where setter = me and for_date = p_today and kind = 'dial';
  select * into theirs from public.puzzles where solver = me and for_date = p_today and kind = 'dial';

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'prompt', coalesce(mine.prompt, theirs.prompt),
    'mine', case when mine.id is not null then public.dial_view(mine, me) end,
    'theirs', case
      when theirs.id is null then null
      when mine.id is null then jsonb_build_object('locked', true)
      else public.dial_view(theirs, me)
    end
  );
end;
$$;

-- set_top5(date,text,text[],int[]), as of 0006_top_5.sql
create or replace function public.set_top5(p_for_date date, p_prompt text, p_items text[], p_rank int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  them uuid;
  theme text := p_prompt;
  items text[] := p_items;
  existing public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null then raise exception 'not paired'; end if;
  if p_items is null or array_length(p_items, 1) <> 5
     or exists (select 1 from unnest(p_items) t where char_length(trim(t)) = 0) then
    raise exception 'five items, please';
  end if;
  if not public.is_top5_order(p_rank) then raise exception 'that is not a ranking of all five'; end if;
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select prompt, array(select jsonb_array_elements_text(payload -> 'items'))
    into theme, items
    from public.puzzles
   where setter = them and for_date = p_for_date and kind = 'top5';
  theme := coalesce(theme, p_prompt);
  items := coalesce(items, p_items);

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'top5';
  if found then
    if existing.progress is not null then raise exception 'they have already started it'; end if;
    update public.puzzles
       set prompt = theme, payload = jsonb_build_object('items', to_jsonb(items), 'rank', to_jsonb(p_rank))
     where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, payload)
    values (mine, me, them, p_for_date, 'top5', theme, '',
            jsonb_build_object('items', to_jsonb(items), 'rank', to_jsonb(p_rank)));
  end if;
end;
$$;

-- submit_top5(uuid,int[]), as of 0010_solve_then_set.sql
create or replace function public.submit_top5(p_puzzle uuid, p_guess int[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

-- daily_top5(date), as of 0006_top_5.sql
create or replace function public.daily_top5(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

  select * into mine from public.puzzles where setter = me and for_date = p_today and kind = 'top5';
  select * into theirs from public.puzzles where solver = me and for_date = p_today and kind = 'top5';

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'prompt', coalesce(mine.prompt, theirs.prompt),
    'mine', case when mine.id is not null then public.top5_view(mine, me) end,
    'theirs', case
      when theirs.id is null then null
      when mine.id is null then jsonb_build_object('locked', true)
      else public.top5_view(theirs, me)
    end
  );
end;
$$;

-- set_sketch(date,text,text,jsonb), as of 0007_sketch.sql
create or replace function public.set_sketch(p_for_date date, p_prompt text, p_answer text, p_strokes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  them uuid;
  answer text := trim(p_answer);
  question text := p_prompt;
  existing public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null then raise exception 'not paired'; end if;
  if char_length(answer) < 1 or char_length(answer) > 30 or public.sketch_norm(answer) = '' then
    raise exception 'answer must be 1 to 30 characters';
  end if;
  if p_strokes is null or jsonb_typeof(p_strokes) <> 'array' or jsonb_array_length(p_strokes) = 0 then
    raise exception 'draw something first';
  end if;
  -- Generous for a phone sketch, small enough that nobody's pushing a novel through it.
  if octet_length(p_strokes::text) > 120000 then raise exception 'that drawing is too big'; end if;
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select prompt into question from public.puzzles
   where setter = them and for_date = p_for_date and kind = 'sketch';
  question := coalesce(question, p_prompt);

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'sketch';
  if found then
    if existing.progress is not null then raise exception 'they have already started it'; end if;
    update public.puzzles
       set prompt = question, payload = jsonb_build_object('answer', answer, 'strokes', p_strokes)
     where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, payload)
    values (mine, me, them, p_for_date, 'sketch', question, '',
            jsonb_build_object('answer', answer, 'strokes', p_strokes));
  end if;
end;
$$;

-- submit_sketch(uuid,text), as of 0010_solve_then_set.sql
create or replace function public.submit_sketch(p_puzzle uuid, p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

-- daily_sketch(date), as of 0007_sketch.sql
create or replace function public.daily_sketch(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

  select * into mine from public.puzzles where setter = me and for_date = p_today and kind = 'sketch';
  select * into theirs from public.puzzles where solver = me and for_date = p_today and kind = 'sketch';

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'prompt', coalesce(mine.prompt, theirs.prompt),
    'mine', case when mine.id is not null then public.sketch_view(mine, me) end,
    'theirs', case
      when theirs.id is null then null
      when mine.id is null then jsonb_build_object('locked', true)
      else public.sketch_view(theirs, me)
    end
  );
end;
$$;

-- set_numbers(date,text[],int[]), as of 0008_their_numbers.sql
create or replace function public.set_numbers(p_for_date date, p_questions text[], p_answers int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  them uuid;
  questions text[] := p_questions;
  existing public.puzzles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  select user_id into them from public.members where couple_id = mine and user_id <> me;
  if them is null then raise exception 'not paired'; end if;
  if p_questions is null or array_length(p_questions, 1) <> 5
     or exists (select 1 from unnest(p_questions) q where char_length(trim(q)) = 0) then
    raise exception 'five questions, please';
  end if;
  if not public.is_five_numbers(p_answers) then raise exception 'five whole numbers, 0 to 9999'; end if;
  if p_for_date not between current_date - 2 and current_date + 3 then raise exception 'bad date'; end if;

  select array(select jsonb_array_elements_text(payload -> 'questions'))
    into questions
    from public.puzzles
   where setter = them and for_date = p_for_date and kind = 'numbers';
  questions := coalesce(questions, p_questions);

  select * into existing from public.puzzles where setter = me and for_date = p_for_date and kind = 'numbers';
  if found then
    if existing.progress is not null then raise exception 'they have already started it'; end if;
    update public.puzzles
       set payload = jsonb_build_object('questions', to_jsonb(questions), 'answers', to_jsonb(p_answers))
     where id = existing.id;
  else
    insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, payload)
    values (mine, me, them, p_for_date, 'numbers', 'Their Numbers', '',
            jsonb_build_object('questions', to_jsonb(questions), 'answers', to_jsonb(p_answers)));
  end if;
end;
$$;

-- submit_numbers(uuid,int[]), as of 0010_solve_then_set.sql
create or replace function public.submit_numbers(p_puzzle uuid, p_guesses int[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

-- daily_numbers(date), as of 0008_their_numbers.sql
create or replace function public.daily_numbers(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

  select * into mine from public.puzzles where setter = me and for_date = p_today and kind = 'numbers';
  select * into theirs from public.puzzles where solver = me and for_date = p_today and kind = 'numbers';

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'questions', coalesce(mine.payload -> 'questions', theirs.payload -> 'questions'),
    'mine', case when mine.id is not null then public.numbers_view(mine, me) end,
    'theirs', case
      when theirs.id is null then null
      when mine.id is null then jsonb_build_object('locked', true)
      else public.numbers_view(theirs, me)
    end
  );
end;
$$;

-- streak(date), as of 0009_streak_any_puzzle.sql
create or replace function public.streak(p_today date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine uuid;
begin
  if public.person() is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = public.person();
  if mine is null then return 0; end if;
  return public.couple_streak(mine, p_today);
end;
$$;

-- board(date), as of 0010_solve_then_set.sql
create or replace function public.board(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
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

-- my_couple_code(), as of 0011_couple_room_code.sql
create or replace function public.my_couple_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.room_code from public.couples c
    join public.members m on m.couple_id = c.id
   where m.user_id = public.person()
$$;

-- save_moment(text,date,jsonb), as of 0012_memories.sql
create or replace function public.save_moment(p_session_key text, p_played_on date, p_payload jsonb)
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
  if not exists (select 1 from public.members where couple_id = mine and user_id <> me) then
    raise exception 'not paired';
  end if;
  -- The phone's date, give or take a timezone.
  if p_played_on not between current_date - 2 and current_date + 2 then raise exception 'bad date'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'bad memory'; end if;
  if octet_length(p_payload::text) > 300000 then raise exception 'memory is too big'; end if;

  insert into public.moments (couple_id, session_key, played_on, payload)
  values (mine, p_session_key, p_played_on, p_payload)
  on conflict (couple_id, session_key)
  do update set payload = excluded.payload, updated_at = now();
end;
$$;

-- memories(date,date,int), as of 0012_memories.sql
create or replace function public.memories(p_today date, p_before date default null, p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  my_row public.members;
  partner public.members;
  upto date := least(coalesce(p_before, p_today + 1), p_today + 1);
  since date := upto - greatest(1, least(coalesce(p_days, 30), 90));
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single'); end if;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then return jsonb_build_object('state', 'waiting'); end if;

  return jsonb_build_object(
    'state', 'paired',
    'me', my_row.name,
    'partner', partner.name,
    'since', since,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('key', m.session_key, 'playedOn', m.played_on, 'payload', m.payload)
                       order by m.played_on desc, m.created_at desc)
        from public.moments m
       where m.couple_id = my_row.couple_id and m.played_on >= since and m.played_on < upto
    ), '[]'::jsonb),
    -- Past days only: today's puzzles are still being played. Seen from the setter's
    -- side, so the answer shows — but only once the day is safely over on the server's
    -- clock too, whatever date the phone claims.
    'puzzles', coalesce((
      select jsonb_agg(
               public.any_view(p, p.setter) || jsonb_build_object('mine', p.setter = me)
               order by p.for_date desc, p.kind)
        from public.puzzles p
       where p.couple_id = my_row.couple_id
         and p.for_date >= since and p.for_date < upto
         and p.for_date < p_today
         and (p.status <> 'open' or p.for_date < current_date - 1)
    ), '[]'::jsonb)
  );
end;
$$;

-- profile(), as of 0013_profile.sql
create or replace function public.profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  my_row public.members;
  partner public.members;
  pending text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single'); end if;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then
    select code into pending from public.couples where id = my_row.couple_id;
    return jsonb_build_object('state', 'waiting', 'code', pending,
      'me', jsonb_build_object('name', my_row.name, 'photo', my_row.photo));
  end if;
  return jsonb_build_object(
    'state', 'paired',
    'me', jsonb_build_object('name', my_row.name, 'photo', my_row.photo),
    'partner', jsonb_build_object('name', partner.name, 'photo', partner.photo),
    'since', my_row.joined_at::date
  );
end;
$$;

-- set_name(text), as of 0013_profile.sql
create or replace function public.set_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  clean text := btrim(coalesce(p_name, ''));
begin
  if me is null then raise exception 'not signed in'; end if;
  if char_length(clean) not between 1 and 24 then raise exception 'name must be 1 to 24 characters'; end if;
  update public.members set name = clean where user_id = me;
  if not found then raise exception 'not paired'; end if;
end;
$$;

-- set_photo(text), as of 0013_profile.sql
create or replace function public.set_photo(p_photo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_photo is not null and (p_photo not like 'data:image/%' or octet_length(p_photo) > 60000) then
    raise exception 'photo is too big';
  end if;
  update public.members set photo = p_photo where user_id = me;
  if not found then raise exception 'not paired'; end if;
end;
$$;

-- ideas(), as of 0014_our_questions.sql
create or replace function public.ideas()
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
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'kind', i.kind, 'text', i.text, 'mine', i.author = me, 'createdAt', i.created_at
    ) order by i.created_at, i.id)
    from public.ideas i where i.couple_id = mine
  ), '[]'::jsonb);
end;
$$;

-- add_idea(text,text), as of 0014_our_questions.sql
create or replace function public.add_idea(p_kind text, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  mine uuid;
  clean text := regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g');
  low text;
  high text;
  row public.ideas;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  if mine is null then raise exception 'not paired'; end if;
  if p_kind not in ('mrmrs', 'finger', 'lights', 'wave', 'clash', 'word') then raise exception 'unknown game'; end if;
  if char_length(clean) not between 2 and 120 then raise exception 'idea must be 2 to 120 characters'; end if;
  -- A Wavelength scale is two ends: "Cringe | Cool".
  if p_kind = 'wave' then
    low := btrim(split_part(clean, '|', 1));
    high := btrim(split_part(clean, '|', 2));
    if low = '' or high = '' or clean like '%|%|%' or char_length(low) > 24 or char_length(high) > 24 then
      raise exception 'a scale needs two ends';
    end if;
    clean := low || ' | ' || high;
  end if;
  if (select count(*) from public.ideas where couple_id = mine) >= 500 then
    raise exception 'that''s plenty of ideas';
  end if;
  if exists (select 1 from public.ideas where couple_id = mine and kind = p_kind and lower(text) = lower(clean)) then
    raise exception 'already on the list';
  end if;
  insert into public.ideas (couple_id, author, kind, text) values (mine, me, p_kind, clean) returning * into row;
  return jsonb_build_object('id', row.id, 'kind', row.kind, 'text', row.text, 'mine', true, 'createdAt', row.created_at);
end;
$$;

-- delete_idea(uuid), as of 0014_our_questions.sql
create or replace function public.delete_idea(p_id uuid)
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
  delete from public.ideas where id = p_id and couple_id = mine;
end;
$$;

-- ---------------------------------------------------------------- linking devices

-- A code for another device to become you. One at a time: a new one replaces the last.
create function public.link_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from public.device_codes where person = me or expires_at < now();
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.device_codes where code = new_code)
          and not exists (select 1 from public.couples where code = new_code);
  end loop;
  insert into public.device_codes (code, person, expires_at) values (new_code, me, now() + interval '15 minutes');
  return new_code;
end;
$$;

-- This device becomes the person who made the code. A device that's already somebody
-- (paired, waiting, or linked) can't, so nothing it has is ever silently orphaned.
create function public.link_device(p_code text)
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
  select person into target from public.device_codes
   where code = upper(btrim(coalesce(p_code, ''))) and expires_at > now();
  if target is null then raise exception 'no such code'; end if;
  if target = me then raise exception 'that code is for another device'; end if;
  if exists (select 1 from public.devices where alias = me) then raise exception 'this device is already linked'; end if;
  if exists (select 1 from public.members where user_id = me) then raise exception 'already paired'; end if;
  insert into public.devices (alias, person) values (me, target);
  delete from public.device_codes where code = upper(btrim(p_code));
end;
$$;

-- Stop this device being you. It's back to a fresh start; you and your couple are untouched.
create function public.unlink_device()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.devices where alias = auth.uid()
$$;

-- profile() again, now also saying whether this is a linked device and how many others
-- you have.
create or replace function public.profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
  linked boolean := exists (select 1 from public.devices where alias = auth.uid());
  others int := (select count(*) from public.devices where person = public.person());
  my_row public.members;
  partner public.members;
  pending text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single', 'linked', linked); end if;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then
    select code into pending from public.couples where id = my_row.couple_id;
    return jsonb_build_object('state', 'waiting', 'code', pending, 'linked', linked, 'devices', others,
      'me', jsonb_build_object('name', my_row.name, 'photo', my_row.photo));
  end if;
  return jsonb_build_object(
    'state', 'paired',
    'linked', linked,
    'devices', others,
    'me', jsonb_build_object('name', my_row.name, 'photo', my_row.photo),
    'partner', jsonb_build_object('name', partner.name, 'photo', partner.photo),
    'since', my_row.joined_at::date
  );
end;
$$;

revoke all on function public.link_code() from public, anon, authenticated;
revoke all on function public.link_device(text) from public, anon, authenticated;
revoke all on function public.unlink_device() from public, anon, authenticated;
grant execute on function public.link_code() to authenticated;
grant execute on function public.link_device(text) to authenticated;
grant execute on function public.unlink_device() to authenticated;
