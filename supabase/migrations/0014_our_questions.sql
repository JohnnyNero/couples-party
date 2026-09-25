-- Couples Party, migration 14: Our questions.
--
-- Run once in the SQL Editor, after 0013.
--
-- Your own content, added to the games: Mr & Mrs questions, Put a Finger Down
-- confessions, Lights Out questions, Wavelength scales, Category Clash categories and
-- Their Word questions. One shared list per couple — either of you can add to it or take
-- something out — and the app deals the new ones in ahead of the built-in cards.
--
-- Adds one table and three functions. Nothing else changes.

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('mrmrs', 'finger', 'lights', 'wave', 'clash', 'word')),
  text text not null check (char_length(text) between 2 and 120),
  created_at timestamptz not null default now()
);
create index ideas_couple_idx on public.ideas (couple_id, created_at);
create unique index ideas_no_repeats on public.ideas (couple_id, kind, lower(text));

alter table public.ideas enable row level security;
-- No policies, on purpose: the only way in is the functions below.

-- The couple's whole list, oldest first (the order the app deals them in).
create function public.ideas()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
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

create function public.add_idea(p_kind text, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
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

-- Either of you can take anything off the shared list.
create function public.delete_idea(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mine uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = me;
  if mine is null then raise exception 'not paired'; end if;
  delete from public.ideas where id = p_id and couple_id = mine;
end;
$$;

revoke all on function public.ideas() from public, anon, authenticated;
revoke all on function public.add_idea(text, text) from public, anon, authenticated;
revoke all on function public.delete_idea(uuid) from public, anon, authenticated;
grant execute on function public.ideas() to authenticated;
grant execute on function public.add_idea(text, text) to authenticated;
grant execute on function public.delete_idea(uuid) to authenticated;
