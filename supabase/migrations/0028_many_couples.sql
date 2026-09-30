-- Coupled, migration 28: being in more than one couple.
--
-- Run once in the SQL Editor, after 0027.
--
-- You can now be in several couples — with your partner, and with a friend, your mum, a
-- sibling — and switch between them. One is "the one you're using" at a time; every game,
-- puzzle, streak and memory is that couple's, exactly as before.
--
-- How: in each couple you're a different "persona" — its own id — and public.person(),
-- which every function already asks "who is this?", now answers with the persona for the
-- couple you're using. So none of the games' functions change: to them, each persona is
-- simply someone in one couple. Your first couple's persona is you (your account's own
-- id), so nothing that exists moves.
--
--   personas         each persona and whose account it belongs to
--   active_personas  which one your account is using, if not your own id
--
-- Your name and photo are the same in every couple: changing them changes them everywhere.
-- A person can be in up to 10 couples.

create table public.personas (
  id uuid primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index personas_owner_idx on public.personas (owner);

create table public.active_personas (
  owner uuid primary key references auth.users (id) on delete cascade,
  persona uuid not null references public.personas (id) on delete cascade
);

alter table public.personas enable row level security;
alter table public.active_personas enable row level security;
-- No policies, on purpose: the only way in is the functions below.
revoke all on table public.personas from anon, authenticated;
revoke all on table public.active_personas from anon, authenticated;

-- Everyone already in a couple (or with a puzzle or question to their name) is their own
-- first persona.
insert into public.personas (id, owner)
select u.id, u.id from auth.users u
 where exists (select 1 from public.members m where m.user_id = u.id)
    or exists (select 1 from public.puzzles p where p.setter = u.id or p.solver = u.id)
    or exists (select 1 from public.ideas i where i.author = u.id)
on conflict do nothing;

-- Couples, puzzles and questions now point at personas, not straight at accounts — a
-- second persona isn't an account. Deleting an account still takes everything with it:
-- account → personas → memberships, puzzles, questions.
alter table public.members drop constraint members_user_id_fkey;
alter table public.members add constraint members_user_id_fkey
  foreign key (user_id) references public.personas (id) on delete cascade;
alter table public.puzzles drop constraint puzzles_setter_fkey;
alter table public.puzzles add constraint puzzles_setter_fkey
  foreign key (setter) references public.personas (id) on delete cascade;
alter table public.puzzles drop constraint puzzles_solver_fkey;
alter table public.puzzles add constraint puzzles_solver_fkey
  foreign key (solver) references public.personas (id) on delete cascade;
alter table public.ideas drop constraint ideas_author_fkey;
alter table public.ideas add constraint ideas_author_fkey
  foreign key (author) references public.personas (id) on delete cascade;

-- Someone joining their first couple becomes their own first persona.
create function public.ensure_persona()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.personas (id, owner) values (new.user_id, new.user_id) on conflict do nothing;
  return new;
end;
$$;
create trigger members_persona before insert on public.members
  for each row execute function public.ensure_persona();

-- The account: who's signed in (on any of their devices), whichever couple they're using.
create function public.account()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select d.person from public.devices d where d.alias = auth.uid()), auth.uid())
$$;

-- Who's asking, as every function knows them: the persona for the couple you're using.
create or replace function public.person()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select a.persona from public.active_personas a where a.owner = public.account()), public.account())
$$;

-- Use this persona from now on (your own id means your first).
create function public.use_persona(p_persona uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct uuid := public.account();
begin
  if p_persona = acct then
    delete from public.active_personas where owner = acct;
  else
    insert into public.active_personas (owner, persona) values (acct, p_persona)
      on conflict (owner) do update set persona = excluded.persona;
  end if;
end;
$$;

-- Tidy up after a switch or leaving: a spare persona with no couple goes, and if you're
-- left using one with no couple, you move to the newest couple you're still in (or, in
-- none, back to your own id).
create function public.settle()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct uuid := public.account();
  cur uuid := public.person();
  other uuid;
begin
  delete from public.personas p
   where p.owner = acct and p.id <> acct and p.id <> cur
     and not exists (select 1 from public.members m where m.user_id = p.id);
  if not exists (select 1 from public.members where user_id = cur) then
    select m.user_id into other from public.members m join public.personas p on p.id = m.user_id
     where p.owner = acct order by m.joined_at desc limit 1;
    perform public.use_persona(coalesce(other, acct));
    if cur <> acct then delete from public.personas where id = cur; end if;
  end if;
end;
$$;

-- Every couple you're in, the one you're using marked.
create function public.my_couples()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.user_id,
      'active', m.user_id = public.person(),
      'state', case when o.user_id is null then 'waiting' else 'paired' end,
      'me', jsonb_build_object('name', m.name, 'photo', m.photo),
      'partner', case when o.user_id is null then null else jsonb_build_object('name', o.name, 'photo', o.photo) end,
      'since', m.joined_at::date
    ) order by m.joined_at), '[]'::jsonb)
    from public.personas p
    join public.members m on m.user_id = p.id
    left join public.members o on o.couple_id = m.couple_id and o.user_id <> m.user_id
   where p.owner = public.account()
$$;

-- Switch to another of your couples (an id from my_couples).
create function public.switch_couple(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct uuid := public.account();
begin
  if acct is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.personas p join public.members m on m.user_id = p.id
                  where p.id = p_id and p.owner = acct) then
    raise exception 'not your couple';
  end if;
  perform public.use_persona(p_id);
  perform public.settle();
end;
$$;

-- Make room for another couple: you're now "not in a couple" (on a fresh persona, or one
-- of yours that's free), ready to start one or join one with the usual create_couple /
-- join_couple. Your other couples carry on; switch back to them any time.
create function public.add_couple()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct uuid := public.account();
  free uuid;
  fresh uuid := gen_random_uuid();
begin
  if acct is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.members where user_id = public.person()) then return; end if;
  if (select count(*) from public.personas p join public.members m on m.user_id = p.id where p.owner = acct) >= 10 then
    raise exception 'too many couples';
  end if;
  -- Your first persona, if you've left its couple; else a new one.
  if not exists (select 1 from public.members where user_id = acct) then
    free := acct;
  else
    insert into public.personas (id, owner) values (fresh, acct);
    free := fresh;
  end if;
  perform public.use_persona(free);
end;
$$;

-- Unpairing ends the couple you're using, as before — then you're back in another of
-- yours, if you have one.
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
  perform public.settle();
end;
$$;

-- Joining: never a couple you're already the other half of.
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
  if exists (select 1 from public.members m join public.personas p on p.id = m.user_id
              where m.couple_id = target and p.owner = public.account()) then
    raise exception 'that is you';
  end if;

  insert into public.members (user_id, couple_id, name) values (me, target, left(trim(p_name), 24));
  update public.couples set code = null where id = target;
end;
$$;

-- Your name and photo: the same in every couple you're in.
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
  update public.members set name = clean
   where user_id = me or user_id in (select id from public.personas where owner = public.account());
  if not found then raise exception 'not paired'; end if;
end;
$$;

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
  update public.members set photo = p_photo
   where user_id = me or user_id in (select id from public.personas where owner = public.account());
  if not found then raise exception 'not paired'; end if;
end;
$$;

-- profile() again, now also saying how many couples you're in.
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
  others int := (select count(*) from public.devices where person = public.account());
  couples int := (select count(*) from public.personas p join public.members m on m.user_id = p.id
                   where p.owner = public.account());
  my_row public.members;
  partner public.members;
  pending text;
  rude boolean;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single', 'linked', linked, 'couples', couples); end if;
  select c.code, c.rude into pending, rude from public.couples c where c.id = my_row.couple_id;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then
    return jsonb_build_object('state', 'waiting', 'code', pending, 'linked', linked, 'devices', others, 'rude', rude,
      'couples', couples, 'me', jsonb_build_object('name', my_row.name, 'photo', my_row.photo));
  end if;
  return jsonb_build_object(
    'state', 'paired',
    'linked', linked,
    'devices', others,
    'rude', rude,
    'couples', couples,
    'me', jsonb_build_object('name', my_row.name, 'photo', my_row.photo),
    'partner', jsonb_build_object('name', partner.name, 'photo', partner.photo),
    'since', my_row.joined_at::date
  );
end;
$$;

-- Deleting your account: every couple you're in (both of you, as before), every
-- persona, you on every device.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct uuid := public.account();
begin
  if acct is null then raise exception 'not signed in'; end if;
  delete from public.couples
   where id in (select m.couple_id from public.members m
                 where m.user_id = acct or m.user_id in (select id from public.personas where owner = acct));
  delete from public.personas where owner = acct;
  delete from auth.users where id in (select alias from public.devices where person = acct);
  delete from auth.users where id in (acct, auth.uid());
end;
$$;

revoke all on function public.ensure_persona() from public, anon, authenticated;
revoke all on function public.account() from public, anon, authenticated;
revoke all on function public.person() from public, anon, authenticated;
revoke all on function public.use_persona(uuid) from public, anon, authenticated;
revoke all on function public.settle() from public, anon, authenticated;
revoke all on function public.my_couples() from public, anon, authenticated;
revoke all on function public.switch_couple(uuid) from public, anon, authenticated;
revoke all on function public.add_couple() from public, anon, authenticated;
revoke all on function public.leave_couple() from public, anon, authenticated;
revoke all on function public.join_couple(text, text) from public, anon, authenticated;
revoke all on function public.set_name(text) from public, anon, authenticated;
revoke all on function public.set_photo(text) from public, anon, authenticated;
revoke all on function public.profile() from public, anon, authenticated;
revoke all on function public.delete_account() from public, anon, authenticated;
grant execute on function public.my_couples() to authenticated;
grant execute on function public.switch_couple(uuid) to authenticated;
grant execute on function public.add_couple() to authenticated;
grant execute on function public.leave_couple() to authenticated;
grant execute on function public.join_couple(text, text) to authenticated;
grant execute on function public.set_name(text) to authenticated;
grant execute on function public.set_photo(text) to authenticated;
grant execute on function public.profile() to authenticated;
grant execute on function public.delete_account() to authenticated;
