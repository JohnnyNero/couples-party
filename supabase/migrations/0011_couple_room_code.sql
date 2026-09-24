-- Couples Party, migration 11: skip the room code for paired phones.
--
-- Run once in the SQL Editor, after 0010.
--
-- Tonight (and any live session) used to ask you to share a room code or link, even
-- once you were already paired for the daily puzzles. Now, if you're paired, the app
-- joins your live session straight from a code of its own — nothing to type or share.
-- Unpaired phones still get Playroom's own share-link flow, unchanged.
--
-- This needs its own code rather than reusing `couples.code`: that one is deliberately
-- single-use (join_couple blanks it the moment your partner uses it), where a room
-- code has to keep working for as long as you're paired. Adds one column.

alter table public.couples add column room_code text unique;

do $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- same as create_couple's: no 0/O, 1/I/L
  r public.couples;
  new_code text;
begin
  for r in select * from public.couples where room_code is null loop
    loop
      new_code := '';
      for i in 1..10 loop
        new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (select 1 from public.couples where room_code = new_code);
    end loop;
    update public.couples set room_code = new_code where id = r.id;
  end loop;
end;
$$;

alter table public.couples alter column room_code set not null;

-- Set alongside the pairing code, so a couple has its room from the moment they exist —
-- create_couple and join_couple both stay untouched otherwise.
create or replace function public.create_couple(p_name text)
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

-- Your couple's room code, for the live session to join straight into. Null if you're
-- not paired.
create function public.my_couple_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.room_code from public.couples c
    join public.members m on m.couple_id = c.id
   where m.user_id = auth.uid()
$$;

revoke all on function public.my_couple_code() from public, anon, authenticated;
grant execute on function public.my_couple_code() to authenticated;
