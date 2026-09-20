# Couples Party — M3 (Act III · Shortlist) Implementation Plan

**Goal:** Build Act III end to end — the author writes seven items, the ranker may veto one,
the items are then revealed one at a time while both players commit to a slot, and the reveal
compares actual against predicted. Runs twice, roles swapped. Works in screen and duo modes.

**Spec:** `Two-Player Party Game — Build Spec.md` — "Act III — Shortlist", "UI contract",
"Rules that must never be skipped".

## Design ruling M3-1 — the stake replaces the pot, so acts award a tally

The pot was cut in favour of a single agreed forfeit (`state.stake`). The spec's Act III
outcomes are written in pot currency ("author takes 3 forfeits"). Ruling: an act outcome
awards **points** to a player, on the same numbers the spec gives, and the player with more
points at the end of the session wins — the other owes the single stake. Level at the end →
`SUDDEN_DEATH` (M5).

To keep the spec's "no score field anywhere" rule, the tally is **never stored**. It is
derived from the act records by `src/engine/standing.ts`, exactly as the spec derived standing
from the `forfeits` array. `stakeOwedBy` stays unset until the end of the session.

| Displacement | Award |
| --- | --- |
| 0 | author **+3** |
| 1–4 | author **+1** |
| 5–12 | nothing |
| 13+ | ranker **+1** |

## Global constraints

- `src/engine/reducer.ts` imports nothing with side effects — no `Date.now()` (time arrives as
  the `now` arg), no `Math.random()` (randomness only via seeded `makeRng` over `state.seed`).
- Content lives in `packs/*.json`, loaded at boot and carried into state — never in engine logic.
- **The items never render on the board before `LIST_REVEAL`.** One-at-a-time revelation is the
  whole act; a board that spoils the list destroys it. The swap is unattributed and silent.
- Board shows occupancy only — which slots are taken, never what is in them.
- Absolute-timestamp clock, auto-advance always, no continue button.
- `src/net/playroom.ts` is the only file importing `playroomkit`.
- Three colours, tabular numerals, no icons/shadows/gradients/rounded corners, phone targets ≥ 48px.

## Flow after this milestone

```
… → MELD_RESULT
   → LIST_WRITE 60s → LIST_SWAP 20s → LIST_PLACE 15s ×7 → LIST_REVEAL 15s   (author A)
   → LIST_WRITE 60s → LIST_SWAP 20s → LIST_PLACE 15s ×7 → LIST_REVEAL 15s   (author B)
   → DONE
```

## Tasks

### 3.1 Engine — list acts, placement, displacement (pure, TDD)

- `rng.ts`: add `shuffled(rng, arr)` so reveal order is seeded and reproducible.
- `state.ts`: `ListAct` gains `placeIndex` (0-based, which item is being placed) and
  `swapDone`; `SessionState` gains `themes: Theme[]`; actions `SUBMIT_ITEMS`, `SWAP_ITEM`,
  `PLACE_ITEM`.
- `phases.ts`: `LIST_WRITE` 60s, `LIST_SWAP` 20s, `LIST_PLACE` 15s, `LIST_REVEAL` 15s;
  `LIST = { items: 7, maxLen: 40 }`.
- `reducer.ts`:
  - `MELD_RESULT` timeout → `beginList(author 'A')`; theme picked with a seeded stream and
    never repeated across the two runs.
  - `SUBMIT_ITEMS` adds **one** locked field (same shape as the old forfeit write), ignored past
    seven. Seventh item ends the phase early.
  - `LIST_WRITE` timeout pads to seven with `(blank)` — seven slots need seven items.
  - `SWAP_ITEM` (ranker only): `index: number | null`; null = declined. Either way the phase ends
    immediately, then the items are shuffled into reveal order.
  - `PLACE_ITEM`: ranker writes `actualSlot`, author writes `predictedSlot`. A taken slot in that
    player's own grid is rejected. Both placed → next item, or `LIST_REVEAL` after the seventh.
  - `LIST_PLACE` timeout: each player who has not placed takes their **lowest free slot**.
  - `LIST_REVEAL` computes `displacement`; its timeout starts run 2 or ends the act.
- `standing.ts`: `listAward`, `standing`, `leader` — all derived, nothing stored.

### 3.2 Views — board and controller

- `views/list.ts`: `currentAct`, `themeText` (`{name}` substitution), `usedSlots`, `freeSlots`.
- Screen: `ScreenListWrite` (theme + n-of-7 counts), `ScreenListSwap` (theme + waiting; no items),
  `ScreenListPlace` (the current item + two occupancy grids), `ScreenListReveal` (two columns,
  matching rows accented, displacement and the award line).
- Play: `PlayListWrite` (author: seven fields, locked one at a time / ranker: theme + waiting),
  `PlayListSwap` (ranker: tap one to replace, or keep all / author: waiting),
  `PlayListPlace` (item + seven slots, taken ones dead).
- Wire into `views/board.tsx` + `views/controller.tsx` so screen and duo both get them; extend
  `railText` with `ACT III · ITEM n OF 7`.
- Board's bottom-left region shows the stake plus the derived standing.

### 3.3 Packs and boot

- `packs/list.json` themes loaded at boot alongside the gap seed words, carried into
  `initialState`.

### 3.4 Debug

- `?debug=1`: fill-list (seven items), swap-skip, place-both.
