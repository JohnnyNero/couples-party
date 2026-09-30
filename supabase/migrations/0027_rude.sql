-- Coupled, migration 27: rude questions, on or off.
--
-- Run once in the SQL Editor, after 0026.
--
-- A few of the games' questions are properly rude (they're tagged "(rude)" in the
-- content file). Each couple now has a switch for them, shared by both of you: either
-- of you can flip it on the Profile page. Couples who already exist keep them on, as
-- they've had them all along; new couples start with them off.

alter table public.couples add column rude boolean not null default true;
alter table public.couples alter column rude set default false;

-- profile() again, now also saying whether your couple has rude questions on.
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
  rude boolean;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into my_row from public.members where user_id = me;
  if not found then return jsonb_build_object('state', 'single', 'linked', linked); end if;
  select c.code, c.rude into pending, rude from public.couples c where c.id = my_row.couple_id;
  select * into partner from public.members where couple_id = my_row.couple_id and user_id <> me;
  if not found then
    return jsonb_build_object('state', 'waiting', 'code', pending, 'linked', linked, 'devices', others, 'rude', rude,
      'me', jsonb_build_object('name', my_row.name, 'photo', my_row.photo));
  end if;
  return jsonb_build_object(
    'state', 'paired',
    'linked', linked,
    'devices', others,
    'rude', rude,
    'me', jsonb_build_object('name', my_row.name, 'photo', my_row.photo),
    'partner', jsonb_build_object('name', partner.name, 'photo', partner.photo),
    'since', my_row.joined_at::date
  );
end;
$$;

create function public.set_rude(p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.person();
begin
  if me is null then raise exception 'not signed in'; end if;
  update public.couples set rude = coalesce(p_on, false)
   where id = (select couple_id from public.members where user_id = me);
  if not found then raise exception 'not in a couple'; end if;
end;
$$;

revoke all on function public.profile() from public, anon, authenticated;
revoke all on function public.set_rude(boolean) from public, anon, authenticated;
grant execute on function public.profile() to authenticated;
grant execute on function public.set_rude(boolean) to authenticated;
