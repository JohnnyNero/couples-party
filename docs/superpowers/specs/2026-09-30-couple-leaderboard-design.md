# Couple leaderboard: design

2026-09-30

## Intent

A friendly weekly scoreboard that ranks your couple against your friend couples, at the
top of the Friends tab. It shows nothing the friend card doesn't already show (no
answers, puzzles or Memories) — only a points total.

Success: open Friends, see where your couple stands among your friends this week, and
see it reset on Monday.

Not the existing `src/store/leaderboard.ts`, which is a local you-vs-your-partner
tally. This is couple vs couple and needs the server.

## Decisions

- **Ranked on weekly points**, Monday to Sunday (ISO week, as in migration 0016), reset
  every Monday. Streak stays on the friend cards as a side stat.
- **Top of the Friends tab, this week only.** No last-week view, no crown, no separate
  sub-tab (deliberately left out for now).
- **Worked out on demand on the server**, never stored — as the rest of the scoring is.
  Rejected: a stored weekly-totals table updated on every save (a new write path,
  backfill and reset logic for a list capped at 101 couples).

## What counts

A couple's points this week are:

1. Both partners' `puzzle_points()` over their puzzles with `for_date` from this
   week's Monday to today, plus
2. their Today-game team score for each day this week: the best `team` value among that
   day's `tonight` moments (the same reading `friend_card` uses for today), summed over
   the days.

Both sources are counted with `p_today` as the caller's date, as everywhere else. A
couple with nothing this week is listed at 0.

## What's shown

Ranked highest first, over the caller's couple plus its friends. Ties share a rank. Each
row: rank, the couple's faces and names, points. The caller's couple is highlighted. A
line says the board resets Monday. A caller with no friends sees an "add a friend to
start a leaderboard" prompt instead of a one-row list. Only the total is exposed — no
per-game breakdown — so it reveals no more than the friend card.

A person in several couples (migration 0028) is ranked as the couple they're currently
using, as `my_pair()` resolves it. Unpaired or half-paired callers get an empty result,
as `friends()` does.

## Server

Migration `0029_leaderboard.sql`, run by hand after 0028:

`friend_leaderboard(p_today date) returns jsonb` — `security definer`, `stable`,
`set search_path = ''`, granted to `authenticated` and revoked from the rest, like the
other friend functions. Uses `my_pair()` and `friendships`. Returns an array of
`{ id, members: [{name, photo}], points, me }`, already sorted, with `me` true on the
caller's own couple. Raises `not signed in` when there's no person, returns `[]` when
there's no whole couple. No tables change; `friends()` is unchanged.

## Client

- `api.friendLeaderboard(today)` in `src/daily/api.ts`, with a `LeaderboardRow` type.
- A `Leaderboard` component at the top of `src/friends/FriendsTab.tsx`, reusing
  `CoupleFaces` and `coupleName`. Ranking with ties shared is a small pure function,
  unit-tested.
- If the server doesn't have the function yet (migration not run), the section hides
  itself rather than showing an error, as `board()` falls back.
- Loaded with the friend list and refreshed when a friend is added or removed.

## Testing

- `supabase/schema.test.ts` (PGlite): ranking order; ties; the Monday reset (points
  from the previous week don't count); both point sources; the best-save-per-day rule;
  a non-friend never appears; a friendless caller sees only themselves; an unpaired
  caller gets `[]`; a signed-out call raises.
- Vitest for the client ranking/tie function.

## Docs

`docs/ROADMAP.md`: move "Couple leaderboards" from Next to a Done entry.
`supabase/README.md`: add the 0029 step and note it must be run in the SQL Editor.

## Out of scope

Last week's winner or crowns, all-time or streak boards, a global (non-friend)
leaderboard, notifications when someone overtakes you.
