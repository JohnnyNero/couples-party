-- Couples Party, migration 5: The Dial — a daily Wavelength.
--
-- Run once in the SQL Editor, after 0004.
--
-- The Dial is landing as its OWN card on the Today tab for now, next to Their Word,
-- not yet merged into a single rotating slot — that merge is the last step, once Top 5,
-- Sketch and Their Numbers exist too (see docs/ROADMAP.md). Until then this migration
-- only adds to the puzzles table; nothing about Their Word changes.
--
-- Same shape as a Wordle puzzle, minus the six guesses: you set a hidden point on a
-- scale (0..100) and a one-word clue for it; your partner slides to where they think it
-- sits, once. `answer` stays unused for this kind (an empty string, to satisfy the
-- column without loosening a constraint Their Word depends on); the target and clue
-- live in the new `payload` column instead, and the guess and its distance in `progress`.

alter table public.puzzles drop constraint puzzles_kind_check;
alter table public.puzzles add constraint puzzles_kind_check check (kind in ('word', 'dial'));
alter table public.puzzles add column payload jsonb;
alter table public.puzzles add column progress jsonb;

-- What the solver may see: the clue is the hint, so it's never hidden — only the target
-- is, until they've guessed (or unless you're the one who set it).
create function public.dial_view(p public.puzzles, p_viewer uuid)
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
    'clue', p.payload ->> 'clue',
    'guess', case when p.progress is not null then (p.progress ->> 'guess')::int end,
    'distance', case when p.progress is not null then (p.progress ->> 'distance')::int end,
    'status', p.status,
    'target', case when p.status <> 'open' or p_viewer = p.setter then (p.payload ->> 'target')::int end
  )
$$;
revoke all on function public.dial_view(public.puzzles, uuid) from public, anon, authenticated;

-- Set today's mark and clue. Mirrors set_word: the couple shares one spectrum a day —
-- whoever gets there first fixes it — and it's changeable until your partner has guessed.
create function public.set_dial(p_for_date date, p_prompt text, p_target int, p_clue text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
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

-- One slide, once — no six-guess loop, so a repeat call after you've already guessed
-- just hands back what you got rather than erroring.
create function public.submit_dial(p_puzzle uuid, p_guess int)
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
  if not exists (
    select 1 from public.puzzles where setter = me and for_date = p.for_date and kind = 'dial'
  ) then
    raise exception 'answer yours first';
  end if;
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

-- Everything the Dial card needs, in one call — same shape as daily(), including the
-- lock: theirs stays hidden until you've set yours.
create function public.daily_dial(p_today date)
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

revoke all on function public.set_dial(date, text, int, text) from public, anon, authenticated;
revoke all on function public.submit_dial(uuid, int) from public, anon, authenticated;
revoke all on function public.daily_dial(date) from public, anon, authenticated;

grant execute on function public.set_dial(date, text, int, text) to authenticated;
grant execute on function public.submit_dial(uuid, int) to authenticated;
grant execute on function public.daily_dial(date) to authenticated;
