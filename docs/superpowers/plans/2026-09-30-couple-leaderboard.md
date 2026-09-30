# Couple Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weekly points leaderboard at the top of the Friends tab that ranks your couple against your friend couples.

**Architecture:** One new Postgres function, `friend_leaderboard(p_today)`, sums each couple's points for the current ISO week on demand (puzzle points plus the best Today-game team score per day) via a private helper `couple_week_points`. Nothing is stored. The client calls it alongside `friends()`, ranks ties with a small pure function, and hides the section if the server doesn't have the function yet.

**Tech Stack:** Postgres (Supabase) SQL migration, tested in PGlite via Vitest; React 18 + TypeScript + Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-30-couple-leaderboard-design.md`

## Global Constraints

- Ranked on **weekly points**, ISO week Monday to Sunday, resets Monday; the caller's `p_today` is "today" everywhere.
- Points = both partners' `puzzle_points()` for puzzles with `for_date` in Monday..today, plus for each day this week the best (`max`) `team` value among that day's `tonight` moments, summed.
- Exposes only a total per couple: no per-game breakdown, answers, puzzles or Memories.
- Worked out on demand, never stored; no tables change; `friends()` and `friend_card()` are unchanged.
- New functions: `security definer`, `set search_path = ''`, `revoke all ... from public, anon, authenticated`, then grant `execute` to `authenticated` only for the public one. The helper is not granted.
- Client hides the section (no error) when the function is missing (`DailyError.kind === 'setup'`); it must fail quietly for any error.
- Migration is `supabase/migrations/0029_leaderboard.sql`, run by hand after 0028.

## Review Focus

Failure modes the spec implies that no single happy-path test would catch:

1. **Today is a Monday, or Sunday.** The week must start on the same Monday the SQL computes, and last Sunday must never count. Pinned in Task 1 (previous-Sunday puzzle and moment excluded, Monday's included).
2. **A puzzle worth NULL points.** `puzzle_points` is NULL for an open puzzle or a solved one with no guesses; that must not turn the whole total into NULL. Pinned in Task 1.
3. **The same night saved several times.** Two `tonight` moments on one day count once, at the higher team score. Pinned in Task 1.
4. **A non-friend couple, or the helper called directly.** `couple_week_points` lets anyone probe any couple's total by id if it's callable. Pinned in Task 1 (permission denied for `authenticated`).
5. **Everyone tied, including at 0.** Two couples on 0 both rank 1, and the next is 3rd if three tie for 1st then one below. Pinned in Task 2.

## File Structure

- Create `supabase/migrations/0029_leaderboard.sql`: `couple_week_points` (private helper) and `friend_leaderboard` (public).
- Modify `supabase/schema.test.ts`: import 0029, add to `MIGRATIONS`, add a `the couple leaderboard` describe.
- Create `src/friends/rank.ts` and `src/friends/rank.test.ts`: pure competition-ranking of rows.
- Modify `src/daily/api.ts`: `LeaderboardRow` type and `api.friendLeaderboard`.
- Create `src/friends/Leaderboard.tsx`: the section UI.
- Modify `src/friends/FriendsTab.tsx`: load the board with the friends and render it first.
- Modify `supabase/README.md` and `docs/ROADMAP.md`.

---

### Task 1: The server function

**Files:**
- Create: `supabase/migrations/0029_leaderboard.sql`
- Modify: `supabase/schema.test.ts` (imports ~line 30, `MIGRATIONS` ~line 55, new describe appended after the `friend couples` describe)

**Interfaces:**
- Produces: SQL `public.friend_leaderboard(p_today date) returns jsonb`, an array of `{ id: uuid, members: [{name, photo}], points: int, me: boolean }`, sorted by points descending, then couple name, then id; `[]` for a caller with no whole couple; raises `not signed in` when no person. Private helper `public.couple_week_points(p_couple uuid, p_today date) returns int`.

- [ ] **Step 1: Register the migration in the test file**

In `supabase/schema.test.ts`, after the `m0028` import add:

```ts
import m0029 from './migrations/0029_leaderboard.sql?raw'
```

and append `m0029` to the end of the `MIGRATIONS` array (after `m0028`).

- [ ] **Step 2: Write the failing tests**

Append after the closing `})` of `describe('friend couples', ...)`. Read the end of that describe first so this goes after it, not inside it.

```ts
describe('the couple leaderboard', () => {
  // Fresh people, so none of the earlier tests' puzzles or games are in the totals.
  const GUS = '00000000-0000-0000-0000-0000000000c1'
  const HAL = '00000000-0000-0000-0000-0000000000c2'
  const IVY = '00000000-0000-0000-0000-0000000000c3'
  const JO = '00000000-0000-0000-0000-0000000000c4'
  const KIT = '00000000-0000-0000-0000-0000000000c5'
  const LOU = '00000000-0000-0000-0000-0000000000c6'
  const NEL = '00000000-0000-0000-0000-0000000000c7' // on her own

  const shift = (iso: string, days: number) => {
    const d = new Date(iso + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const monday = () => {
    const d = new Date(today() + 'T00:00:00Z')
    return shift(today(), -((d.getUTCDay() + 6) % 7))
  }
  // A puzzle solved in `guesses` guesses: 1 is worth 10, 3 is worth 6.
  const solved = (setter: string, solver: string, forDate: string, guesses: string[]) =>
    db.exec(`insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, guesses, status)
             select couple_id, '${setter}', '${solver}', '${forDate}', 'word', 'p', 'pasta', '{${guesses.join(',')}}', 'solved'
               from public.members where user_id = '${setter}'`)
  const night = (uid: string, key: string, team: number) =>
    call(uid, 'save_moment', [key, today(), { v: 1, game: 'tonight', team, finished: true }])
  const rows = async (uid: string) => (await call(uid, 'friend_leaderboard', [today()])) as { id: string; members: { name: string }[]; points: number; me: boolean }[]
  const names = (r: { members: { name: string }[] }) => r.members.map((m) => m.name).join(' & ')

  beforeAll(async () => {
    await db.exec(`insert into auth.users (id) values ('${GUS}'), ('${HAL}'), ('${IVY}'), ('${JO}'), ('${KIT}'), ('${LOU}'), ('${NEL}')`)
    await call(HAL, 'join_couple', [await call(GUS, 'create_couple', ['Gus']), 'Hal'])
    await call(JO, 'join_couple', [await call(IVY, 'create_couple', ['Ivy']), 'Jo'])
    await call(LOU, 'join_couple', [await call(KIT, 'create_couple', ['Kit']), 'Lou'])
    await call(IVY, 'add_friend', [await call(GUS, 'friend_code')]) // Gus & Hal are friends with Ivy & Jo, not Kit & Lou
  })

  it('lists a couple with no friends alone, at 0', async () => {
    const solo = await rows(KIT)
    expect(solo.map(names)).toEqual(['Kit & Lou'])
    expect(solo[0]).toMatchObject({ points: 0, me: true })
  })

  it('is empty for someone not in a whole couple, and refuses someone signed out', async () => {
    expect(await rows(NEL)).toEqual([])
    await expect(as('', `select public.friend_leaderboard('${today()}')`)).rejects.toThrow(/not signed in/)
  })

  it('adds up both partners’ puzzle points and the best night of each day, this week only', async () => {
    await solved(GUS, HAL, today(), ['pasta']) // 10, solved by Hal
    await solved(HAL, GUS, monday(), ['a', 'b', 'pasta']) // 6, solved by Gus
    await solved(GUS, HAL, shift(monday(), -1), ['pasta']) // last Sunday: not this week
    await db.exec(`insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, guesses, status)
                   select couple_id, '${GUS}', '${HAL}', '${today()}', 'either', 'p', '', '{}', 'open'
                     from public.members where user_id = '${GUS}'`) // open: worth NULL, must not null the total
    await night(GUS, 'lb-night-a', 20)
    await night(HAL, 'lb-night-b', 30) // a second save of the night, higher: counts once, at 30
    await db.exec(`insert into public.moments (couple_id, session_key, played_on, payload)
                   select couple_id, 'lb-old', '${shift(monday(), -1)}', '{"game":"tonight","team":99}'
                     from public.members where user_id = '${GUS}'`) // last Sunday's night: not this week
    const board = await rows(GUS)
    expect(board.find((r) => r.me)).toMatchObject({ points: 10 + 6 + 30 })
  })

  it('ranks you with your friends, highest first — and never a couple that is not your friend', async () => {
    await solved(IVY, JO, today(), ['a', 'pasta']) // 8, solved by Jo
    const mine = await rows(GUS)
    expect(mine.map(names)).toEqual(['Gus & Hal', 'Ivy & Jo'])
    expect(mine.map((r) => r.points)).toEqual([46, 8])
    expect(mine.map((r) => r.me)).toEqual([true, false])
    const theirs = await rows(IVY)
    expect(theirs.map(names)).toEqual(['Gus & Hal', 'Ivy & Jo']) // the same board from the other side
    expect(theirs.map((r) => r.me)).toEqual([false, true])
    expect(JSON.stringify(mine)).not.toMatch(/Kit|Lou|pasta/)
  })

  it('breaks a tie by name, and drops a friend once you are no longer friends', async () => {
    await night(IVY, 'lb-night-c', 38) // Ivy & Jo now 46 too
    expect((await rows(GUS)).map(names)).toEqual(['Gus & Hal', 'Ivy & Jo']) // tied at 46: by name
    const ivyRow = (await rows(GUS)).find((r) => names(r) === 'Ivy & Jo')!
    await call(GUS, 'remove_friend', [ivyRow.id])
    expect((await rows(GUS)).map(names)).toEqual(['Gus & Hal'])
    expect((await rows(IVY)).map(names)).toEqual(['Ivy & Jo'])
  })

  it('keeps the total helper private, so no one can look up a couple by id', async () => {
    await expect(as(GUS, `select public.couple_week_points(gen_random_uuid(), '${today()}')`)).rejects.toThrow(/permission/)
  })
})
```

The open `either` puzzle scores 0 and the `puzzles` unique key is `(setter, for_date, kind)`, so it doesn't collide with the `word` rows.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run supabase/schema.test.ts -t "couple leaderboard"`
Expected: FAIL, the migration file `0029_leaderboard.sql` can't be resolved (or, once it exists empty, `friend_leaderboard` does not exist).

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/0029_leaderboard.sql`:

```sql
-- Coupled, migration 29: the couple leaderboard.
--
-- Run once in the SQL Editor, after 0028.
--
-- Friends get a weekly leaderboard: you and your friend couples, ranked by points since
-- Monday (ISO weeks, as in 0016). A couple's points this week are both partners' puzzle
-- points plus, for each day, the best team score among that day's Today games. Only the
-- total is ever shown — never answers, puzzles or Memories. Worked out when asked, never
-- stored, like every other score here. No tables change.

-- One couple's points this week, as of p_today. Private: callable only from inside the
-- functions below, so nobody can look up a couple that isn't their friend.
create function public.couple_week_points(p_couple uuid, p_today date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    coalesce((select sum(public.puzzle_points(p))
                from public.puzzles p
               where p.couple_id = p_couple
                 and p.for_date between date_trunc('week', p_today)::date and p_today), 0)
    + coalesce((select sum(d.best)
                  from (select max((mo.payload ->> 'team')::numeric) as best
                          from public.moments mo
                         where mo.couple_id = p_couple
                           and mo.payload ->> 'game' = 'tonight'
                           and mo.played_on between date_trunc('week', p_today)::date and p_today
                         group by mo.played_on) d), 0)
  )::int
$$;

-- You and your friends, best first (points, then names, so a tie is stable).
create function public.friend_leaderboard(p_today date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mine uuid := public.my_pair();
begin
  if public.person() is null then raise exception 'not signed in'; end if;
  if mine is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'members', c.members, 'points', c.points, 'me', c.id = mine)
                     order by c.points desc, c.name, c.id)
      from (
        select x.id,
               public.couple_week_points(x.id, p_today) as points,
               coalesce((select jsonb_agg(jsonb_build_object('name', m.name, 'photo', m.photo) order by m.joined_at)
                           from public.members m where m.couple_id = x.id), '[]'::jsonb) as members,
               coalesce((select string_agg(m.name, ' & ' order by m.joined_at)
                           from public.members m where m.couple_id = x.id), '') as name
          from (select mine as id
                union
                select case when f.a = mine then f.b else f.a end
                  from public.friendships f where f.a = mine or f.b = mine) x
      ) c
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.couple_week_points(uuid, date) from public, anon, authenticated;
revoke all on function public.friend_leaderboard(date) from public, anon, authenticated;
grant execute on function public.friend_leaderboard(date) to authenticated;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run supabase/schema.test.ts -t "couple leaderboard"`
Expected: PASS (6 tests). If the totals differ, print `await rows(GUS)` and check which point source is off before changing the SQL; the expected numbers are 10 + 6 + 30 = 46 for Gus & Hal.

- [ ] **Step 6: Run the whole schema suite**

Run: `npx vitest run supabase/schema.test.ts`
Expected: PASS, no earlier test broken (the new function touches no existing one).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0029_leaderboard.sql supabase/schema.test.ts
git commit -m "Couple leaderboard: migration 0029 and its tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The client

**Files:**
- Create: `src/friends/rank.ts`, `src/friends/rank.test.ts`, `src/friends/Leaderboard.tsx`
- Modify: `src/daily/api.ts` (near `FriendCard`, ~line 360, and `api.friends`, ~line 390), `src/friends/FriendsTab.tsx`

**Interfaces:**
- Consumes: SQL `friend_leaderboard(p_today)` from Task 1; `coupleName` and `CoupleFaces` exported from `src/friends/FriendsTab.tsx`.
- Produces: `type LeaderboardRow = { id: string; members: Person[]; points: number; me: boolean }` and `api.friendLeaderboard(today: string): Promise<LeaderboardRow[]>` in `src/daily/api.ts`; `rankRows<T extends { points: number }>(rows: T[]): (T & { rank: number })[]` in `src/friends/rank.ts`.

- [ ] **Step 1: Write the failing test for ranking**

Create `src/friends/rank.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rankRows } from './rank'

const pts = (...points: number[]) => points.map((p) => ({ points: p }))

describe('ranking the leaderboard', () => {
  it('numbers rows in order', () => {
    expect(rankRows(pts(50, 30, 10)).map((r) => r.rank)).toEqual([1, 2, 3])
  })
  it('gives a tie the same rank and skips the ones it took', () => {
    expect(rankRows(pts(50, 50, 30, 30, 30, 5)).map((r) => r.rank)).toEqual([1, 1, 3, 3, 3, 6])
  })
  it('ranks everyone level, even at 0, first together', () => {
    expect(rankRows(pts(0, 0, 0)).map((r) => r.rank)).toEqual([1, 1, 1])
  })
  it('keeps the rest of each row, and copes with nothing', () => {
    expect(rankRows([{ points: 7, id: 'x' }])).toEqual([{ points: 7, id: 'x', rank: 1 }])
    expect(rankRows([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/friends/rank.test.ts`
Expected: FAIL, `Failed to resolve import "./rank"`.

- [ ] **Step 3: Implement the ranking**

Create `src/friends/rank.ts`:

```ts
// Competition ranking for a list already sorted best first: a tie shares a rank and the
// rank after it skips the places taken (1, 1, 3), so two couples on 0 are both first.
export function rankRows<T extends { points: number }>(rows: T[]): (T & { rank: number })[] {
  const out: (T & { rank: number })[] = []
  rows.forEach((r, i) => out.push({ ...r, rank: i > 0 && rows[i - 1].points === r.points ? out[i - 1].rank : i + 1 }))
  return out
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/friends/rank.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the API call**

In `src/daily/api.ts`, after the `FriendPreview` type add:

```ts
// The couple leaderboard (migration 0029): you and your friends, ranked on this week's points.
export type LeaderboardRow = { id: string; members: Person[]; points: number; me: boolean }
```

and after the `friends:` line in `api` add:

```ts
  friendLeaderboard: (today: string) => rpc<LeaderboardRow[]>('friend_leaderboard', { p_today: today }),
```

- [ ] **Step 6: Build the section**

Create `src/friends/Leaderboard.tsx`:

```tsx
import type { LeaderboardRow } from '../daily/api'
import { card, eyebrow } from '../ui/styles'
import { CoupleFaces, coupleName } from './FriendsTab'
import { rankRows } from './rank'

// This week's points for you and your friend couples, best first. Resets every Monday.
// Shows a totals-only view: the same amount of your day a friend card already shows.
export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length < 2) {
    return (
      <section className={card + ' p-4 text-center text-sm text-fg/55'}>
        <div className={eyebrow}>This week</div>
        <div className="mt-1">Add a friend couple to start a leaderboard.</div>
      </section>
    )
  }
  return (
    <section className={card + ' p-4 flex flex-col gap-2'}>
      <div className="flex items-baseline justify-between">
        <div className={eyebrow}>Leaderboard · this week</div>
        <div className="text-[0.7rem] font-bold text-fg/40">Resets Monday</div>
      </div>
      <ol className="flex flex-col gap-1.5">
        {rankRows(rows).map((r) => (
          <li key={r.id} className={'flex items-center gap-3 rounded-2xl px-3 py-2 ' + (r.me ? 'bg-tan-soft text-tan-ink' : 'bg-fg/[0.04]')}>
            <span className="w-6 text-center font-display text-lg font-extrabold tabular-nums">{r.rank}</span>
            <CoupleFaces members={r.members} size="sm" />
            <span className="flex-1 min-w-0 truncate font-bold">{coupleName(r.members)}{r.me ? ' (you)' : ''}</span>
            <span className="font-display text-lg font-extrabold tabular-nums">{r.points}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

`CoupleFaces` accepts `size` of `'sm' | 'md' | 'lg'`, so `sm` is valid. `card` and `eyebrow` are already imported from `../ui/styles` in `FriendsTab.tsx`.

- [ ] **Step 7: Wire it into the Friends tab**

In `src/friends/FriendsTab.tsx`:

1. Change the api import to include the row type: `import { api, DailyError, type FriendCard, type LeaderboardRow, type Person } from '../daily/api'` and add `import { Leaderboard } from './Leaderboard'`.
2. Add state next to `list`: `const [board, setBoard] = useState<LeaderboardRow[] | null>(null)`.
3. In `load`, after the `api.friends(...)` call, add: `api.friendLeaderboard(localDate()).then(setBoard).catch(() => setBoard(null)) // hidden until the server has it`.
4. In the returned JSX, add `{board && <Leaderboard rows={board} />}` immediately before `<AddFriends ... />`.

- [ ] **Step 8: Typecheck, build and run all tests**

Run: `npm run build` then `npm test`
Expected: `tsc -b` clean, the build succeeds, all Vitest files pass. A circular import between `FriendsTab.tsx` and `Leaderboard.tsx` is fine at runtime (both only use each other's exports inside functions), but if the build complains, move `coupleName` and `CoupleFaces` into `src/friends/faces.tsx` and re-export them from `FriendsTab.tsx`.

- [ ] **Step 9: Commit**

```bash
git add src/friends src/daily/api.ts
git commit -m "Couple leaderboard: ranking, api call and the Friends tab section

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Docs

**Files:**
- Modify: `supabase/README.md` (after entry 28, before "Run a new one before deploying")
- Modify: `docs/ROADMAP.md` (the "Next" list and a new Done entry)

- [ ] **Step 1: README**

After the entry for `0028`, add:

```markdown
29. `migrations/0029_leaderboard.sql` — the couple leaderboard: `friend_leaderboard(date)`
   ranks you and your friend couples on this week's points (puzzle points plus the best
   Today-game team score each day, Monday to Sunday). Only totals are shown. Adds one
   private helper, `couple_week_points`. No tables change. Run it in the SQL Editor
   before deploying the app that shows the board.
```

Also change the sentence in "Why the anon key is in the repo" from "...today's team score and how many of today's puzzles are solved — never answers." to "...today's team score, how many of today's puzzles are solved and their points this week — never answers."

- [ ] **Step 2: Roadmap**

In `docs/ROADMAP.md`, remove item 1 ("**Couple leaderboards**, among friend couples.") from `## Next` and renumber, then add above `## Done: the TV system deleted`:

```markdown
## Done: couple leaderboard (migration 0029)

At the top of the Friends tab: you and your friend couples ranked on this week's points,
resetting every Monday. A couple's points are both partners' puzzle points plus, for each
day, the best Today-game team score of that day's saves. Ties share a rank. Only the total
is shown, so it reveals no more than the friend card. Worked out on demand by
`friend_leaderboard()`, never stored; the section hides if the server doesn't have it yet.
Left out on purpose: last week's winner or crown, streak and all-time boards, a global
board, and "someone overtook you" alerts. Migration 0029 has to be run by hand in the
Supabase SQL Editor.
```

- [ ] **Step 3: Verify and commit**

Run: `npm test`
Expected: PASS.

```bash
git add supabase/README.md docs/ROADMAP.md
git commit -m "Docs: the couple leaderboard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
