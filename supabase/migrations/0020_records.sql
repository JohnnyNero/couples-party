-- Coupled, migration 20: records, and Our questions for the new games.
--
-- Run once in the SQL Editor, after 0019.
--
-- Records: every night you've saved (Memories keeps them), trimmed to what the records
-- page needs — the game, when, the names, each of your scores and your team score, and
-- whether it was played to the end. The app works out the bests and the head-to-head
-- from these, so nothing new is stored. Nights saved before team points existed simply
-- have no team score.
--
-- Our questions can now add to Two Lies & a Truth (prompts), Mind Meld (prompts) and
-- Describe It (words).

create function public.records()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mine uuid;
begin
  if public.person() is null then raise exception 'not signed in'; end if;
  select couple_id into mine from public.members where user_id = public.person();
  if mine is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'playedOn', m.played_on,
             'game', m.payload -> 'game',
             'players', m.payload -> 'players',
             'score', m.payload -> 'score',
             'team', m.payload -> 'team',
             'finished', m.payload -> 'finished',
             'games', m.payload -> 'games',
             'longestChain', (select max(jsonb_array_length(c -> 'words'))
                                from jsonb_array_elements(coalesce(m.payload -> 'chain', '[]'::jsonb)) c)
           ) order by m.played_on, m.created_at)
      from public.moments m
     where m.couple_id = mine
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.records() from public, anon, authenticated;
grant execute on function public.records() to authenticated;

alter table public.ideas drop constraint ideas_kind_check;
alter table public.ideas add constraint ideas_kind_check
  check (kind in ('mrmrs', 'finger', 'lights', 'wave', 'clash', 'word', 'bluff', 'meld', 'describe'));

-- add_idea(text,text), as of 0015_more_than_one_device.sql — three more games.
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
  if p_kind not in ('mrmrs', 'finger', 'lights', 'wave', 'clash', 'word', 'bluff', 'meld', 'describe') then raise exception 'unknown game'; end if;
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
