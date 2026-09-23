-- Couples Party, migration 6: Top 5 — a daily Shortlist.
--
-- Run once in the SQL Editor, after 0005.
--
-- Its own card, like The Dial — not yet the final rotation (see docs/ROADMAP.md).
-- Reuses the payload/progress columns 0005 added; no further schema change.
--
-- Five things from a Shortlist theme (the same five, in the same order, on both
-- phones — the app picks them by date). You rank them for real; your partner guesses
-- your order, once. `payload.items` is the five as offered, pinned so a content change
-- mid-day can't split you onto different sets; `payload.rank` is your true order, kept
-- from your partner until they've guessed (or it's yours to see back); `progress.guess`
-- is their attempt, scored on the server the moment it lands.

alter table public.puzzles drop constraint puzzles_kind_check;
alter table public.puzzles add constraint puzzles_kind_check check (kind in ('word', 'dial', 'top5'));

-- What the solver may see: the five items are never hidden (there's nothing to rank
-- without them) — only whose order is the true one, until they've guessed.
create function public.top5_view(p public.puzzles, p_viewer uuid)
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
    'items', p.payload -> 'items',
    'rank', case when p.status <> 'open' or p_viewer = p.setter then p.payload -> 'rank' end,
    'guess', p.progress -> 'guess',
    'exact', case when p.progress is not null then (p.progress ->> 'exact')::int end,
    'near', case when p.progress is not null then (p.progress ->> 'near')::int end,
    'status', p.status
  )
$$;
revoke all on function public.top5_view(public.puzzles, uuid) from public, anon, authenticated;

-- A permutation of 0..4 — every rank and every guess has to be exactly this.
create function public.is_top5_order(p int[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null and array_length(p, 1) = 5
    and (select array_agg(x order by x) from unnest(p) x) = array[0, 1, 2, 3, 4]
$$;
revoke all on function public.is_top5_order(int[]) from public, anon, authenticated;

-- Rank today's five. Mirrors set_word/set_dial: the couple shares one set of five a
-- day — whoever gets there first fixes it — and it's changeable until your partner has
-- guessed.
create function public.set_top5(p_for_date date, p_prompt text, p_items text[], p_rank int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
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

-- One ranking, once — like The Dial, a repeat call after you've already guessed just
-- hands back what you got rather than erroring.
create function public.submit_top5(p_puzzle uuid, p_guess int[])
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
  if not exists (
    select 1 from public.puzzles where setter = me and for_date = p.for_date and kind = 'top5'
  ) then
    raise exception 'answer yours first';
  end if;
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

-- Everything the Top 5 card needs, in one call — same shape as daily()/daily_dial(),
-- lock included.
create function public.daily_top5(p_today date)
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

revoke all on function public.set_top5(date, text, text[], int[]) from public, anon, authenticated;
revoke all on function public.submit_top5(uuid, int[]) from public, anon, authenticated;
revoke all on function public.daily_top5(date) from public, anon, authenticated;

grant execute on function public.set_top5(date, text, text[], int[]) to authenticated;
grant execute on function public.submit_top5(uuid, int[]) to authenticated;
grant execute on function public.daily_top5(date) to authenticated;
