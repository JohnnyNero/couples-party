-- Couples Party, migration 13: your profile.
--
-- Run once in the SQL Editor, after 0012.
--
-- A profile page: change your name, add a photo, unpair. The photo is a small square
-- picture the phone has already shrunk (a data: URL of a few KB), kept on your member
-- row next to your name — no storage bucket to set up.
--
-- Unpairing changes too. It used to take only you out, leaving your partner in a couple
-- of one with no code to share and nothing to play. Now it ends the couple for both of
-- you, the same as it would in real life: the couple, its puzzles and its memories go,
-- and both phones are back at "Pair up".
--
-- Adds one column and three functions, and replaces leave_couple.

alter table public.members add column photo text
  check (photo is null or (photo like 'data:image/%' and octet_length(photo) <= 60000));

-- Who you are and who you're with, for the profile page and every avatar in the app.
create function public.profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
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

create function public.set_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  clean text := btrim(coalesce(p_name, ''));
begin
  if me is null then raise exception 'not signed in'; end if;
  if char_length(clean) not between 1 and 24 then raise exception 'name must be 1 to 24 characters'; end if;
  update public.members set name = clean where user_id = me;
  if not found then raise exception 'not paired'; end if;
end;
$$;

-- null takes the photo off.
create function public.set_photo(p_photo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_photo is not null and (p_photo not like 'data:image/%' or octet_length(p_photo) > 60000) then
    raise exception 'photo is too big';
  end if;
  update public.members set photo = p_photo where user_id = me;
  if not found then raise exception 'not paired'; end if;
end;
$$;

-- Unpair: the couple goes, for both of you. Its members, puzzles and memories all go
-- with it (they cascade from couples).
create or replace function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mine uuid;
begin
  select couple_id into mine from public.members where user_id = me;
  if mine is not null then
    delete from public.couples where id = mine;
  end if;
end;
$$;

revoke all on function public.profile() from public, anon, authenticated;
revoke all on function public.set_name(text) from public, anon, authenticated;
revoke all on function public.set_photo(text) from public, anon, authenticated;
grant execute on function public.profile() to authenticated;
grant execute on function public.set_name(text) to authenticated;
grant execute on function public.set_photo(text) to authenticated;
