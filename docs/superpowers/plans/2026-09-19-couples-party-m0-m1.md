# Couples Party — M0 + M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the skeleton (M0) and a standalone, playable Mind Meld act (M1) as a greybox — the spec's designated "real gate" — running on a shared screen with two phones over Playroom Stream Mode.

**Architecture:** One React + Vite + TS app. A pure, dependency-free reducer computes every state transition over a single `SessionState`; the Playroom host runs the reducer and broadcasts state, phones dispatch actions via RPC, and every client renders from the broadcast state only. Screen vs phone is chosen by Playroom's `isStreamScreen()`.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v3, Playroom Kit (`playroomkit`), Vitest for engine tests.

**Spec:** `Two-Player Party Game — Build Spec.md` (repo root). Read it alongside this plan.

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from the spec.

- **`src/engine/reducer.ts` imports nothing.** Pure functions over `SessionState`, testable in Node with no network and no React. (Time enters as an explicit `now: number` argument — never `Date.now()` inside the reducer.)
- **Content never lives in code.** Every prompt, statement, seed word and category sits in `packs/*.json`, loaded at boot.
- **No score field anywhere.** Standing is derived from `forfeits`. (No forfeits in M0/M1, but the type must carry no score field.)
- **`authoredBy` is never rendered.**
- **Nothing private ever renders on the host screen.** Submitted-yet counts only, never contents.
- **Absolute timestamps, one clock.** `phaseEndsAt` is epoch milliseconds, set once by the authority and broadcast; clients render `phaseEndsAt − Date.now()`. Never broadcast a decrementing number.
- **Auto-advance, always.** Every timed phase advances on expiry regardless of what's been submitted. There is no continue button anywhere.
- **The player always knows the game is waiting.** Every phone answers: what am I doing, how long have I got, has it been received. A submitted state must look different from an unsubmitted one.
- **Visual language:** one typeface (a grotesque with real numerals), two weights, three colours (background, foreground, one accent — accent only ever marks whose turn it is). No rounded corners, shadows, gradients, or icons. Design for a laptop at 1280×720. Phone tap targets ≥ 48px.

## Reconciliations with the spec (read before starting)

Two deliberate, documented deviations. Both are functionally identical to the spec's intent.

1. **Screen/play split via `isStreamScreen()`, not two hand-navigated routes.** Playroom Stream Mode auto-detects the shared display vs a phone and provides the join flow. The app calls `insertCoin({ streamMode: true })` once, then renders `<Screen/>` when `isStreamScreen()` is true and `<Play/>` otherwise. React Router still exists for the future `?debug=1` harness and `/souvenir/:id` route.
2. **Authority = Playroom's `isHost()` client, not "Player A's phone."** The spec states host-authority cheating "is not a threat model worth spending on," so which client owns the reducer is immaterial to correctness. The host client runs the reducer and broadcasts; everyone else renders the broadcast.

---

## PART A — Executable plan (M0 + M1)

### File structure (created across Part A)

```
packs/
  gap.json              # seedWords used by M1; statements stubbed for later
src/
  main.tsx              # entry: init net, choose Screen/Play, router for souvenir/debug
  App.tsx               # top-level chooser
  engine/
    state.ts            # SessionState, Phase, Action types, initialState()
    rng.ts              # seeded PRNG (mulberry32) + pick()
    match.ts            # word normalization + isMatch (Mind Meld matching)
    phases.ts           # phase durations + Act I constants
    reducer.ts          # (state, action, now) => state — PURE, imports nothing
    reducer.test.ts     # Vitest
    match.test.ts       # Vitest
    rng.test.ts         # Vitest
  net/
    playroom.ts         # the only file that imports playroomkit
    ids.ts              # Playroom player.id <-> PlayerId ('A'|'B') mapping
  packs.ts              # loads packs/*.json at boot
  screen/
    Screen.tsx          # host renderer shell (act rail / stage / pot / clock regions)
    Clock.tsx           # countdown from phaseEndsAt
    phases/
      ScreenJoin.tsx
      ScreenMeldType.tsx
      ScreenMeldReveal.tsx
      ScreenMeldResult.tsx
  play/
    Play.tsx            # phone renderer shell
    phases/
      PlayJoin.tsx
      PlayMeldType.tsx
      PlayWaiting.tsx
  debug/
    DebugBar.tsx        # ?debug=1 harness (skip-phase, force-reveal, fill-both, jump)
```

---

### Task 0.1: Scaffold the app

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx` (placeholder)

**Interfaces:**
- Produces: a running dev server on `http://localhost:5173` rendering a placeholder.

- [ ] **Step 1: Initialize git and Vite React-TS project**

Run in repo root (it is NOT yet a git repo):
```bash
git init
npm create vite@latest . -- --template react-ts
```
When prompted about the non-empty directory (the spec `.md` and `docs/` exist), choose "Ignore files and continue".

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install playroomkit react-router-dom
npm install -D tailwindcss@3 postcss autoprefixer vitest
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#111111',
        fg: '#f5f5f5',
        accent: '#ffcc00',
      },
      fontFamily: {
        board: ['Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

`src/index.css` (replace contents):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { background: #111111; color: #f5f5f5; margin: 0; }
```

- [ ] **Step 4: Add a test script**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Placeholder App and main**

`src/App.tsx`:
```tsx
export default function App() {
  return <div className="font-board p-8 text-2xl">Couples Party — scaffold OK</div>
}
```

Ensure `src/main.tsx` imports `./index.css` and renders `<App/>`.

- [ ] **Step 6: Run and verify**

Run: `npm run dev`
Expected: `http://localhost:5173` shows "Couples Party — scaffold OK" on a dark background.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + react + ts + tailwind"
```

---

### Task 0.2: Engine core — types, rng, matching, phase config

**Files:**
- Create: `src/engine/state.ts`, `src/engine/rng.ts`, `src/engine/match.ts`, `src/engine/phases.ts`
- Test: `src/engine/rng.test.ts`, `src/engine/match.test.ts`

**Interfaces:**
- Produces:
  - `type PlayerId = 'A' | 'B'`
  - `type Phase` (string union, full game listed; M1 uses a subset)
  - `type Action` (union; M1 uses `JOIN | SUBMIT_WORD | TIMEOUT`)
  - `type SessionState`
  - `function initialState(seed: number): SessionState`
  - `function makeRng(seed: number): () => number`
  - `function pick<T>(rng: () => number, arr: readonly T[]): T`
  - `function normalize(word: string): string`
  - `function isMatch(a: string | null, b: string | null): boolean`
  - `const DURATIONS: Partial<Record<Phase, number>>`, `const MELD: { roundCap: number; burnThreshold: number }`

- [ ] **Step 1: Write the failing rng test**

`src/engine/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { makeRng, pick } from './rng'

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42); const b = makeRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('produces values in [0,1)', () => {
    const r = makeRng(7)
    for (let i = 0; i < 100; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
  it('pick returns a member of the array', () => {
    const r = makeRng(1)
    const arr = ['x', 'y', 'z']
    expect(arr).toContain(pick(r, arr))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rng`
Expected: FAIL (module not found / not implemented).

- [ ] **Step 3: Implement rng.ts**

`src/engine/rng.ts`:
```ts
// mulberry32 — small, fast, seedable PRNG. Keeps a session reproducible.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- rng`
Expected: PASS.

- [ ] **Step 5: Write the failing match test**

`src/engine/match.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalize, isMatch } from './match'

describe('normalize', () => {
  it('lowercases and trims', () => { expect(normalize('  Cat ')).toBe('cat') })
  it('folds simple plurals', () => { expect(normalize('cats')).toBe('cat') })
  it('does not fold -ss', () => { expect(normalize('glass')).toBe('glass') })
  it('does not fold short words', () => { expect(normalize('is')).toBe('is') })
})

describe('isMatch', () => {
  it('matches case/space/plural variants', () => {
    expect(isMatch('Cats', ' cat ')).toBe(true)
  })
  it('does not match different words', () => {
    expect(isMatch('cat', 'dog')).toBe(false)
  })
  it('null never matches (strict)', () => {
    expect(isMatch(null, 'cat')).toBe(false)
    expect(isMatch('cat', null)).toBe(false)
    expect(isMatch(null, null)).toBe(false)
  })
  it('empty strings never match', () => {
    expect(isMatch('', '')).toBe(false)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- match`
Expected: FAIL.

- [ ] **Step 7: Implement match.ts**

`src/engine/match.ts`:
```ts
// Deliberately strict. A near-miss the game rejects is better than one it
// generously accepts — the players get to argue about it. Err strict.
export function normalize(word: string): string {
  let s = word.trim().toLowerCase()
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1)
  return s
}

export function isMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const na = normalize(a)
  if (na.length === 0) return false
  return na === normalize(b)
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- match`
Expected: PASS.

- [ ] **Step 9: Implement state.ts**

`src/engine/state.ts` (no runtime deps; types + a factory):
```ts
export type PlayerId = 'A' | 'B'

export type Phase =
  | 'BOOT' | 'JOIN'
  | 'FORFEIT_WRITE' | 'POT_SHUFFLE'
  | 'MELD_TYPE' | 'MELD_REVEAL' | 'MELD_RESULT'
  | 'GAP_STATEMENT' | 'GAP_INPUT' | 'GAP_CALL' | 'GAP_REVEAL' | 'GAP_RESULT'
  | 'LIST_WRITE' | 'LIST_SWAP' | 'LIST_PLACE' | 'LIST_REVEAL'
  | 'SUDDEN_DEATH' | 'SOUVENIR'
  | 'DONE' // M1 terminal placeholder; replaced when M2 wires the pot/next act

export type Forfeit = {
  id: string
  text: string
  authoredBy: PlayerId // never rendered
  state: 'pot' | 'burned' | 'owed'
  owedBy?: PlayerId
}

export type MeldRound = {
  index: number // 1-based
  words: Record<PlayerId, string | null>
  converged: boolean
}

export type MeldResult = {
  rounds: MeldRound[]
  roundsTaken: number // 7 = failed
  converged: boolean
  finalWord: string | null
  seedPair: [string, string] // round 1's shown pair (deviation: seeds stored here)
}

// Full-game types carried now so state.ts is stable; unused fields stay null in M1.
export type GapRound = {
  index: number; statementId: string
  selfRating: number | null; guessRating: number | null
  isLie: boolean; called: boolean
}
export type GapAct = {
  subject: PlayerId; rounds: GapRound[]
  lieSpent: boolean; callSpent: boolean
  outcome: 'caught' | 'missed' | 'never-called' | null
}
export type ListItem = {
  id: string; text: string; swapped: boolean
  actualSlot: number | null; predictedSlot: number | null
}
export type ListAct = {
  author: PlayerId; themeId: string; items: ListItem[]; displacement: number | null
}

export type SessionState = {
  seed: number
  phase: Phase
  phaseEndsAt: number | null // absolute epoch ms; null = untimed
  players: Record<PlayerId, { name: string; connected: boolean }>
  forfeits: Forfeit[]
  doubledBy: PlayerId | null
  meld: MeldResult | null
  gapActs: GapAct[]
  listActs: ListAct[]
  meldWords: string[] // every word either player typed, incl. misses
}

export type Action =
  | { type: 'JOIN'; player: PlayerId; name: string }
  | { type: 'SUBMIT_WORD'; player: PlayerId; word: string }
  | { type: 'TIMEOUT' }
// Future actions (M2+): SUBMIT_FORFEITS, SUBMIT_RATING, TOGGLE_LIE, CALL,
// SUBMIT_ITEMS, SWAP_ITEM, PLACE_ITEM, DOUBLE

export function initialState(seed: number): SessionState {
  return {
    seed,
    phase: 'JOIN',
    phaseEndsAt: null,
    players: { A: { name: '', connected: false }, B: { name: '', connected: false } },
    forfeits: [],
    doubledBy: null,
    meld: null,
    gapActs: [],
    listActs: [],
    meldWords: [],
  }
}
```

- [ ] **Step 10: Implement phases.ts**

`src/engine/phases.ts`:
```ts
import type { Phase } from './state'

export const DURATIONS: Partial<Record<Phase, number>> = {
  FORFEIT_WRITE: 45000,
  POT_SHUFFLE: 4000,
  MELD_TYPE: 20000,
  MELD_REVEAL: 4000,
  MELD_RESULT: 6000,
}

export const MELD = {
  roundCap: 7,
  burnThreshold: 3, // converge in <= 3 rounds burns a forfeit (wired in M2)
}
```

- [ ] **Step 11: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.
```bash
git add -A
git commit -m "feat(engine): types, seeded rng, strict matching, phase config"
```

---

### Task 0.3: Reducer — Mind Meld transitions (pure, TDD)

**Files:**
- Create: `src/engine/reducer.ts`
- Test: `src/engine/reducer.test.ts`

**Interfaces:**
- Consumes: `SessionState`, `Action`, `initialState` (0.2); `isMatch` (0.2); `makeRng`, `pick` (0.2); `DURATIONS`, `MELD` (0.2). NOTE: `reducer.ts` may import from `state.ts`, `match.ts`, `rng.ts`, `phases.ts` — these are pure sibling engine modules with no I/O. It must NOT import React, the net layer, or anything with side effects.
- Produces: `function reduce(state: SessionState, action: Action, now: number): SessionState` — pure; returns a new state; time enters only via `now`.

**Behavior contract (from spec Act I):**
- Both players connected → Act I begins: `MELD_TYPE` round 1, `phaseEndsAt = now + 20000`, `meld.seedPair` = two distinct seed words picked from a fixed list via the session rng.
- `SUBMIT_WORD` records the word into the current round and pushes it to `meldWords`; when both words are present, phase → `MELD_REVEAL` (`now + 4000`), `round.converged = isMatch(A, B)`.
- `TIMEOUT` in `MELD_TYPE` → `MELD_REVEAL` with whatever words exist (missing = null; a null word is a legal non-match).
- `TIMEOUT` in `MELD_REVEAL` advances: converged → finalize converged; else round ≥ 7 → finalize failed; else two consecutive double-timeouts → finalize failed; else next round `MELD_TYPE` (`now + 20000`).
- `TIMEOUT` in `MELD_RESULT` → `DONE` (M1 terminal).
- Finalize sets `meld.converged`, `meld.roundsTaken`, `meld.finalWord` (the matched word, else null), phase `MELD_RESULT` (`now + 6000`).

The seed word list lives in `packs/gap.json` at runtime (Global Constraint), but the reducer is pure and cannot do I/O. Resolution: the seed list is passed into the game once by seeding — for the reducer we keep a small hardcoded fallback list ONLY inside a helper the net layer overrides. To keep the reducer pure AND content-out-of-code, seeds are chosen by the reducer from a list it receives via the initial state. Implement: add the loaded seed words onto state at boot by the net layer, stored transiently. For M1 simplicity and testability, the reducer picks from `state`-carried seeds:

Add to `SessionState` an optional boot field `seedWords?: string[]` (populated by the net layer from the pack at boot; defaults to a built-in list if absent so tests are self-contained). Update `initialState(seed, seedWords?)` accordingly in this task.

- [ ] **Step 1: Extend initialState to carry seed words**

Modify `src/engine/state.ts`:
- Add `seedWords: string[]` to `SessionState`.
- Change factory to `export function initialState(seed: number, seedWords: string[] = DEFAULT_SEEDS): SessionState` and set `seedWords` in the returned object.
- Add near the top:
```ts
export const DEFAULT_SEEDS = [
  'spaghetti', 'handcuffs', 'cathedral', 'lawnmower',
  'volcano', 'umbrella', 'trombone', 'glacier',
]
```

- [ ] **Step 2: Write failing reducer tests**

`src/engine/reducer.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { initialState } from './state'
import { reduce } from './reducer'

const bothJoined = () => {
  let s = initialState(1)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
  return s
}

describe('join → act I start', () => {
  it('stays in JOIN until both connected', () => {
    let s = initialState(1)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    expect(s.phase).toBe('JOIN')
    expect(s.players.A.connected).toBe(true)
  })
  it('begins MELD_TYPE round 1 when both join, with a seed pair', () => {
    const s = bothJoined()
    expect(s.phase).toBe('MELD_TYPE')
    expect(s.phaseEndsAt).toBe(1000 + 20000)
    expect(s.meld?.rounds.length).toBe(1)
    expect(s.meld?.seedPair[0]).not.toBe(s.meld?.seedPair[1])
  })
})

describe('submitting words', () => {
  it('records a word and accumulates meldWords, staying in MELD_TYPE until both', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'moon' }, 2000)
    expect(s.phase).toBe('MELD_TYPE')
    expect(s.meld?.rounds[0].words.A).toBe('moon')
    expect(s.meldWords).toContain('moon')
  })
  it('non-matching pair → MELD_REVEAL, not converged, then next round', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'moon' }, 2000)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'fork' }, 2500)
    expect(s.phase).toBe('MELD_REVEAL')
    expect(s.meld?.rounds[0].converged).toBe(false)
    s = reduce(s, { type: 'TIMEOUT' }, 6500)
    expect(s.phase).toBe('MELD_TYPE')
    expect(s.meld?.rounds.length).toBe(2)
    expect(s.phaseEndsAt).toBe(6500 + 20000)
  })
  it('matching pair → converged reveal → MELD_RESULT with finalWord', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'Cats' }, 2000)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'cat' }, 2100)
    expect(s.meld?.rounds[0].converged).toBe(true)
    s = reduce(s, { type: 'TIMEOUT' }, 6100)
    expect(s.phase).toBe('MELD_RESULT')
    expect(s.meld?.converged).toBe(true)
    expect(s.meld?.roundsTaken).toBe(1)
    expect(s.meld?.finalWord).toBe('Cats')
  })
})

describe('timeouts and caps', () => {
  it('round cap of 7 ends the act unconverged', () => {
    let s = bothJoined()
    for (let r = 0; r < 7; r++) {
      s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: `a${r}` }, 100)
      s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: `b${r}` }, 100)
      s = reduce(s, { type: 'TIMEOUT' }, 100) // leave reveal
    }
    expect(s.phase).toBe('MELD_RESULT')
    expect(s.meld?.converged).toBe(false)
    expect(s.meld?.roundsTaken).toBe(7)
  })
  it('two consecutive double-timeouts end the act early', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'TIMEOUT' }, 100) // round 1 type -> reveal (both null)
    s = reduce(s, { type: 'TIMEOUT' }, 200) // reveal -> round 2 type
    s = reduce(s, { type: 'TIMEOUT' }, 300) // round 2 type -> reveal (both null)
    s = reduce(s, { type: 'TIMEOUT' }, 400) // reveal -> should finalize (2 double-timeouts)
    expect(s.phase).toBe('MELD_RESULT')
    expect(s.meld?.converged).toBe(false)
  })
  it('MELD_RESULT timeout goes to DONE', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'x' }, 1)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'x' }, 1)
    s = reduce(s, { type: 'TIMEOUT' }, 1) // reveal -> result
    s = reduce(s, { type: 'TIMEOUT' }, 1) // result -> done
    expect(s.phase).toBe('DONE')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- reducer`
Expected: FAIL (reduce not implemented).

- [ ] **Step 4: Implement reducer.ts**

`src/engine/reducer.ts`:
```ts
import type { Action, MeldResult, MeldRound, PlayerId, SessionState } from './state'
import { isMatch } from './match'
import { makeRng, pick } from './rng'
import { DURATIONS, MELD } from './phases'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function beginMeld(state: SessionState, now: number): SessionState {
  const rng = makeRng(state.seed)
  const a = pick(rng, state.seedWords)
  let b = pick(rng, state.seedWords)
  let guard = 0
  while (b === a && guard++ < 20) b = pick(rng, state.seedWords)
  const meld: MeldResult = {
    rounds: [{ index: 1, words: { A: null, B: null }, converged: false }],
    roundsTaken: 0,
    converged: false,
    finalWord: null,
    seedPair: [a, b],
  }
  return { ...clone(state), phase: 'MELD_TYPE', phaseEndsAt: now + DURATIONS.MELD_TYPE!, meld }
}

function currentRound(meld: MeldResult): MeldRound {
  return meld.rounds[meld.rounds.length - 1]
}

function toReveal(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const round = currentRound(s.meld!)
  round.converged = isMatch(round.words.A, round.words.B)
  s.phase = 'MELD_REVEAL'
  s.phaseEndsAt = now + DURATIONS.MELD_REVEAL!
  return s
}

function isDoubleTimeout(r: MeldRound | undefined): boolean {
  return !!r && r.words.A === null && r.words.B === null
}

function finalize(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const meld = s.meld!
  const round = currentRound(meld)
  meld.roundsTaken = round.index
  meld.converged = round.converged
  meld.finalWord = round.converged ? round.words.A : null
  s.phase = 'MELD_RESULT'
  s.phaseEndsAt = now + DURATIONS.MELD_RESULT!
  return s
}

function advanceReveal(state: SessionState, now: number): SessionState {
  const meld = state.meld!
  const round = currentRound(meld)
  const prev = meld.rounds[meld.rounds.length - 2]
  const twoDoubleTimeouts = isDoubleTimeout(round) && isDoubleTimeout(prev)
  if (round.converged || round.index >= MELD.roundCap || twoDoubleTimeouts) {
    return finalize(state, now)
  }
  const s = clone(state)
  s.meld!.rounds.push({ index: round.index + 1, words: { A: null, B: null }, converged: false })
  s.phase = 'MELD_TYPE'
  s.phaseEndsAt = now + DURATIONS.MELD_TYPE!
  return s
}

export function reduce(state: SessionState, action: Action, now: number): SessionState {
  switch (action.type) {
    case 'JOIN': {
      const s = clone(state)
      s.players[action.player] = { name: action.name, connected: true }
      const both = s.players.A.connected && s.players.B.connected
      if (both && s.phase === 'JOIN') return beginMeld(s, now)
      return s
    }
    case 'SUBMIT_WORD': {
      if (state.phase !== 'MELD_TYPE') return state
      const s = clone(state)
      const round = currentRound(s.meld!)
      round.words[action.player as PlayerId] = action.word
      s.meldWords.push(action.word)
      if (round.words.A !== null && round.words.B !== null) return toReveal(s, now)
      return s
    }
    case 'TIMEOUT': {
      switch (state.phase) {
        case 'MELD_TYPE': return toReveal(state, now)
        case 'MELD_REVEAL': return advanceReveal(state, now)
        case 'MELD_RESULT': { const s = clone(state); s.phase = 'DONE'; s.phaseEndsAt = null; return s }
        default: return state
      }
    }
    default:
      return state
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- reducer`
Expected: PASS (all reducer tests).

- [ ] **Step 6: Run the full engine suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all green, no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): pure reducer for Act I Mind Meld with tests"
```

---

### Task 0.4: Playroom transport + integration checkpoint

**This task's acceptance is a manual two-window play, not a unit test — it is the spec's M0 gate: "a phone changes something on the screen." It is also where any Playroom API mismatch surfaces; fix it here, not later.**

**Files:**
- Create: `src/net/ids.ts`, `src/net/playroom.ts`, `src/packs.ts`, `packs/gap.json`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `reduce`, `initialState` (0.3); `Action`, `SessionState`, `PlayerId` (0.2).
- Produces:
  - `packs.ts`: `async function loadPacks(): Promise<{ seedWords: string[] }>`
  - `ids.ts`: `assignPlayerId(playroomId: string): PlayerId` and `getPlayerId(playroomId: string): PlayerId | null` (first joiner → 'A', second → 'B')
  - `playroom.ts`:
    - `async function initNet(): Promise<void>` — calls `insertCoin({ streamMode: true, maxPlayersPerRoom: 2 })`, registers the host RPC handler and the host timer loop.
    - `function useSession(): SessionState` — React hook returning the broadcast state.
    - `function dispatch(action: Action): void` — sends an action to the host (via RPC, or applies locally if this client is host).
    - `function useIsStreamScreen(): boolean` — thin wrapper over `isStreamScreen()`.
    - `function useMyPlayerId(): PlayerId | null`.

- [ ] **Step 1: Create the seed-words pack**

`packs/gap.json`:
```json
{
  "version": 1,
  "seedWords": ["spaghetti", "handcuffs", "cathedral", "lawnmower", "volcano", "umbrella", "trombone", "glacier", "hurricane", "dentist", "harmonica", "avalanche"],
  "statements": []
}
```

- [ ] **Step 2: Implement packs loader**

`src/packs.ts`:
```ts
import gap from '../packs/gap.json'

export async function loadPacks(): Promise<{ seedWords: string[] }> {
  return { seedWords: (gap as { seedWords: string[] }).seedWords }
}
```
(Ensure `resolveJsonModule` is true in `tsconfig.json`; Vite imports JSON natively.)

- [ ] **Step 3: Implement id mapping**

`src/net/ids.ts`:
```ts
import type { PlayerId } from '../engine/state'

const map = new Map<string, PlayerId>()

export function assignPlayerId(playroomId: string): PlayerId {
  const existing = map.get(playroomId)
  if (existing) return existing
  const id: PlayerId = map.size === 0 ? 'A' : 'B'
  map.set(playroomId, id)
  return id
}

export function getPlayerId(playroomId: string): PlayerId | null {
  return map.get(playroomId) ?? null
}
```

- [ ] **Step 4: Implement the net layer**

`src/net/playroom.ts` (the ONLY file importing `playroomkit`):
```ts
import {
  insertCoin, isHost, isStreamScreen, myPlayer, onPlayerJoin,
  useMultiplayerState, RPC,
} from 'playroomkit'
import { useEffect, useState } from 'react'
import type { Action, PlayerId, SessionState } from '../engine/state'
import { initialState } from '../engine/state'
import { reduce } from '../engine/reducer'
import { loadPacks } from '../packs'
import { assignPlayerId, getPlayerId } from './ids'

let seedWords: string[] = []
let started = false

export async function initNet(): Promise<void> {
  if (started) return
  started = true
  const packs = await loadPacks()
  seedWords = packs.seedWords

  await insertCoin({ streamMode: true, maxPlayersPerRoom: 2 })

  // Assign A/B as players join (host is source of truth for the mapping).
  onPlayerJoin((player) => {
    const id = assignPlayerId(player.id)
    if (isHost()) {
      const s: SessionState = (getState('session') as SessionState) ?? freshState()
      setState('session', reduce(s, { type: 'JOIN', player: id, name: player.getProfile?.().name ?? id }, Date.now()), true)
    }
    player.onQuit(() => { /* mark disconnected in M5 reconnection hardening */ })
  })

  if (isHost()) {
    setState('session', freshState(), true)
    RPC.register('dispatch', async (action: Action) => {
      const s = (getState('session') as SessionState) ?? freshState()
      setState('session', reduce(s, action, Date.now()), true)
      return null
    })
    // Host timer loop: fire TIMEOUT when the current phase expires.
    setInterval(() => {
      const s = getState('session') as SessionState | undefined
      if (!s || s.phaseEndsAt == null) return
      if (Date.now() >= s.phaseEndsAt) {
        setState('session', reduce(s, { type: 'TIMEOUT' }, Date.now()), true)
      }
    }, 200)
  }
}

function freshState(): SessionState {
  return initialState(Math.floor(seedWords.length ? 1 : 1) /* fixed seed for repro */ ?? 1, seedWords)
}

// setState/getState are global functions on playroomkit; re-export for host use.
import { setState, getState } from 'playroomkit'

export function useSession(): SessionState {
  const [session] = useMultiplayerState('session', freshState())
  return session as SessionState
}

export function dispatch(action: Action): void {
  if (isHost()) {
    const s = (getState('session') as SessionState) ?? freshState()
    setState('session', reduce(s, action, Date.now()), true)
  } else {
    RPC.call('dispatch', action, RPC.Mode.HOST)
  }
}

export function useIsStreamScreen(): boolean {
  return isStreamScreen()
}

export function useMyPlayerId(): PlayerId | null {
  const me = myPlayer()
  return me ? getPlayerId(me.id) : null
}
```

**Integration note for the implementer:** the exact `getProfile`/name accessor and `RPC.Mode.HOST` spelling may differ by Playroom version. Verify against the installed `playroomkit` typings (`node_modules/playroomkit`) and adjust. The counter test below will confirm the round-trip works before any game UI depends on it.

- [ ] **Step 5: Wire a minimal counter checkpoint**

Temporarily replace `src/App.tsx` with a counter that proves the transport (this is scaffolding for the gate; it is removed in Task 1.x):
```tsx
import { useEffect, useState } from 'react'
import { initNet, useSession, useIsStreamScreen, useMyPlayerId, dispatch } from './net/playroom'

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => { initNet().then(() => setReady(true)) }, [])
  const session = useSession()
  const isScreen = useIsStreamScreen()
  const me = useMyPlayerId()
  if (!ready) return <div className="p-8 font-board">connecting…</div>
  if (isScreen) {
    return (
      <div className="p-8 font-board">
        <div className="text-4xl">SCREEN</div>
        <div className="text-2xl mt-4">phase: {session.phase}</div>
        <div className="text-2xl">A connected: {String(session.players.A.connected)} · B connected: {String(session.players.B.connected)}</div>
      </div>
    )
  }
  return (
    <div className="p-8 font-board">
      <div className="text-4xl">PHONE ({me ?? '?'})</div>
      <button
        className="mt-6 min-h-[48px] px-6 bg-accent text-bg text-2xl"
        onClick={() => me && dispatch({ type: 'JOIN', player: me, name: me })}
      >
        JOIN
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Manual integration test (the gate)**

Run: `npm run dev`
Then:
1. Open `http://localhost:5173` in a normal desktop window → it should show "SCREEN" (Playroom detects the large screen) and Playroom's join instructions.
2. Follow Playroom's join link/QR on a phone (or a narrow second browser window / device emulation) → it shows "PHONE (A)".
3. Tap JOIN on the phone.

Expected: the SCREEN's "A connected" flips to `true` within a moment. Repeat with a second phone for B; when both are connected the phase changes to `MELD_TYPE`.

If the round-trip does not work, debug the Playroom API here (host detection, RPC mode, state key) until it does. **Do not proceed until a phone changes the screen.**

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(net): playroom stream-mode transport with host reducer + integration checkpoint"
```

---

### Task 1.1: Screen renderers for Mind Meld

**Files:**
- Create: `src/screen/Screen.tsx`, `src/screen/Clock.tsx`, `src/screen/phases/ScreenJoin.tsx`, `src/screen/phases/ScreenMeldType.tsx`, `src/screen/phases/ScreenMeldReveal.tsx`, `src/screen/phases/ScreenMeldResult.tsx`
- Modify: `src/App.tsx` (route stream screen to `<Screen/>`)

**Interfaces:**
- Consumes: `useSession` (0.4); `SessionState`, `MeldResult` (0.2).
- Produces: `<Screen/>` — a pure renderer with four fixed regions (act rail, stage, pot, clock); the pot region shows `POT 0` for now (no forfeits until M2).

**Region contract (spec UI):** act rail top one line; stage centre 70%; pot bottom-left; clock bottom-right. Regions never move — only contents change. Nothing private renders (submitted counts only via filled dots, never words).

- [ ] **Step 1: Implement Clock (countdown from phaseEndsAt)**

`src/screen/Clock.tsx`:
```tsx
import { useEffect, useState } from 'react'

export function Clock({ phaseEndsAt }: { phaseEndsAt: number | null }) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (phaseEndsAt == null) return
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [phaseEndsAt])
  if (phaseEndsAt == null) return <div className="text-4xl tabular-nums">&nbsp;</div>
  const secs = Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000))
  return <div className="text-4xl tabular-nums">{secs}</div>
}
```

- [ ] **Step 2: Implement the Screen shell**

`src/screen/Screen.tsx`:
```tsx
import { useSession } from '../net/playroom'
import { Clock } from './Clock'
import { ScreenJoin } from './phases/ScreenJoin'
import { ScreenMeldType } from './phases/ScreenMeldType'
import { ScreenMeldReveal } from './phases/ScreenMeldReveal'
import { ScreenMeldResult } from './phases/ScreenMeldResult'

export function Screen() {
  const s = useSession()
  const railText =
    s.phase.startsWith('MELD') && s.meld
      ? `ACT I · MIND MELD · ROUND ${s.meld.rounds.length} OF 7`
      : s.phase === 'JOIN' ? 'JOIN' : s.phase
  return (
    <div className="h-full w-full font-board flex flex-col p-6 select-none">
      <div className="text-xl tracking-widest border-b border-fg/30 pb-3">{railText}</div>
      <div className="flex-1 flex items-center justify-center">
        {s.phase === 'JOIN' && <ScreenJoin s={s} />}
        {s.phase === 'MELD_TYPE' && <ScreenMeldType s={s} />}
        {s.phase === 'MELD_REVEAL' && <ScreenMeldReveal s={s} />}
        {(s.phase === 'MELD_RESULT' || s.phase === 'DONE') && <ScreenMeldResult s={s} />}
      </div>
      <div className="flex justify-between items-end border-t border-fg/30 pt-3">
        <div className="text-xl tracking-widest">POT 0</div>
        <Clock phaseEndsAt={s.phaseEndsAt} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement the four phase views**

`src/screen/phases/ScreenJoin.tsx`:
```tsx
import type { SessionState } from '../../engine/state'
export function ScreenJoin({ s }: { s: SessionState }) {
  const dot = (on: boolean) => <span className={on ? 'text-accent' : 'text-fg/30'}>●</span>
  return (
    <div className="text-center">
      <div className="text-5xl mb-8">JOIN ON YOUR PHONES</div>
      <div className="text-3xl">{dot(s.players.A.connected)} {s.players.A.name || 'PLAYER A'}</div>
      <div className="text-3xl mt-2">{dot(s.players.B.connected)} {s.players.B.name || 'PLAYER B'}</div>
    </div>
  )
}
```

`src/screen/phases/ScreenMeldType.tsx` — shows the previous round's two words (round 1: the seed pair), plus two dots that fill when each player submits. Never the current words.
```tsx
import type { SessionState } from '../../engine/state'
export function ScreenMeldType({ s }: { s: SessionState }) {
  const meld = s.meld!
  const round = meld.rounds[meld.rounds.length - 1]
  const shown: [string, string] =
    round.index === 1 ? meld.seedPair
      : [meld.rounds[round.index - 2].words.A ?? '—', meld.rounds[round.index - 2].words.B ?? '—']
  const filled = (w: string | null) => (w !== null ? 'text-accent' : 'text-fg/30')
  return (
    <div className="text-center">
      <div className="flex gap-16 justify-center items-center">
        <div className="text-6xl uppercase">{shown[0]}</div>
        <div className="text-4xl text-fg/40">+</div>
        <div className="text-6xl uppercase">{shown[1]}</div>
      </div>
      <div className="mt-12 text-5xl">
        <span className={filled(round.words.A)}>●</span>{' '}
        <span className={filled(round.words.B)}>●</span>
      </div>
    </div>
  )
}
```

`src/screen/phases/ScreenMeldReveal.tsx` — both words appear simultaneously; match centres one word, no-match shows the pair over a history rail.
```tsx
import type { SessionState } from '../../engine/state'
export function ScreenMeldReveal({ s }: { s: SessionState }) {
  const meld = s.meld!
  const round = meld.rounds[meld.rounds.length - 1]
  if (round.converged) {
    return <div className="text-8xl uppercase text-accent">{round.words.A}</div>
  }
  return (
    <div className="text-center">
      <div className="flex gap-16 justify-center">
        <div className="text-7xl uppercase">{round.words.A ?? '—'}</div>
        <div className="text-7xl uppercase">{round.words.B ?? '—'}</div>
      </div>
      <MeldRail meld={meld} />
    </div>
  )
}
function MeldRail({ meld }: { meld: SessionState['meld'] }) {
  if (!meld) return null
  return (
    <div className="mt-10 text-2xl text-fg/50 space-y-1">
      {meld.rounds.slice(0, -1).map((r) => (
        <div key={r.index}>{(r.words.A ?? '—')} / {(r.words.B ?? '—')}</div>
      ))}
    </div>
  )
}
```

`src/screen/phases/ScreenMeldResult.tsx` — the full chain, then the outcome line (no forfeit language yet in M1).
```tsx
import type { SessionState } from '../../engine/state'
export function ScreenMeldResult({ s }: { s: SessionState }) {
  const meld = s.meld!
  const outcome = meld.converged
    ? `CONVERGED IN ${meld.roundsTaken}`
    : 'NO CONVERGENCE'
  return (
    <div className="text-center">
      <div className="text-2xl space-y-1 mb-8">
        {meld.rounds.map((r) => (
          <div key={r.index} className={r.converged ? 'text-accent' : ''}>
            {(r.words.A ?? '—')} / {(r.words.B ?? '—')}
          </div>
        ))}
      </div>
      <div className="text-5xl">{outcome}</div>
    </div>
  )
}
```

- [ ] **Step 4: Route the stream screen to `<Screen/>`**

Modify `src/App.tsx` so that when `useIsStreamScreen()` is true it renders `<Screen/>` (keep the phone side as the counter for now; Task 1.2 replaces it). Keep the `initNet()`/`ready` gating.

- [ ] **Step 5: Manual verify (screen only)**

Run: `npm run dev`, open the desktop window, join two phones, submit words from the counter's JOIN and (temporarily) drive phases with words once Task 1.2 exists. For now confirm: JOIN screen shows two dots that fill as phones join, and on both-joined the rail switches to "ACT I · MIND MELD · ROUND 1 OF 7" with the seed pair and two empty dots.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(screen): mind meld host renderer — rail, stage, clock, pot region"
```

---

### Task 1.2: Phone renderers for Mind Meld

**Files:**
- Create: `src/play/Play.tsx`, `src/play/phases/PlayJoin.tsx`, `src/play/phases/PlayMeldType.tsx`, `src/play/phases/PlayWaiting.tsx`
- Modify: `src/App.tsx` (route phones to `<Play/>`, remove the counter)

**Interfaces:**
- Consumes: `useSession`, `useMyPlayerId`, `dispatch` (0.4); `normalize` (0.2, for the "already said" check).
- Produces: `<Play/>` — shows exactly what this phase needs from this player; a distinct submitted/waiting state; no navigation.

**"Already said" rule:** a word already present in `s.meldWords` (normalized, either player, any prior round) is rejected on the phone with "already said" and the field stays open. This prevents cat/dog/cat/dog loops.

- [ ] **Step 1: Implement PlayJoin**

`src/play/phases/PlayJoin.tsx`:
```tsx
import { useState } from 'react'
import type { PlayerId } from '../../engine/state'
import { dispatch } from '../../net/playroom'
export function PlayJoin({ me, joined }: { me: PlayerId; joined: boolean }) {
  const [name, setName] = useState('')
  if (joined) return <Waiting label="WAITING FOR THE OTHER PLAYER" />
  return (
    <div className="p-6 font-board">
      <div className="text-2xl mb-4">YOUR NAME</div>
      <input
        className="w-full min-h-[48px] text-2xl bg-fg text-bg px-3"
        value={name} onChange={(e) => setName(e.target.value)} maxLength={16}
      />
      <button
        className="mt-6 w-full min-h-[48px] bg-accent text-bg text-2xl disabled:opacity-40"
        disabled={name.trim().length === 0}
        onClick={() => dispatch({ type: 'JOIN', player: me, name: name.trim() })}
      >JOIN</button>
    </div>
  )
}
function Waiting({ label }: { label: string }) {
  return <div className="p-6 font-board text-2xl text-fg/60">{label}</div>
}
```

- [ ] **Step 2: Implement PlayWaiting**

`src/play/phases/PlayWaiting.tsx`:
```tsx
export function PlayWaiting({ label }: { label: string }) {
  return <div className="p-6 font-board text-2xl text-fg/60">{label}</div>
}
```

- [ ] **Step 3: Implement PlayMeldType (input + already-said guard + submitted state)**

`src/play/phases/PlayMeldType.tsx`:
```tsx
import { useEffect, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { normalize } from '../../engine/match'
import { dispatch } from '../../net/playroom'
import { PlayWaiting } from './PlayWaiting'

export function PlayMeldType({ s, me }: { s: SessionState; me: PlayerId }) {
  const meld = s.meld!
  const round = meld.rounds[meld.rounds.length - 1]
  const submitted = round.words[me] !== null
  const [word, setWord] = useState('')
  const [err, setErr] = useState('')
  // Clear the field whenever a new round starts.
  useEffect(() => { setWord(''); setErr('') }, [round.index])

  if (submitted) return <PlayWaiting label="SUBMITTED — WAITING" />

  const shown: [string, string] =
    round.index === 1 ? meld.seedPair
      : [meld.rounds[round.index - 2].words.A ?? '—', meld.rounds[round.index - 2].words.B ?? '—']

  const submit = () => {
    const w = word.trim()
    if (w.length === 0) return
    const already = s.meldWords.some((x) => normalize(x) === normalize(w))
    if (already) { setErr('already said'); return }
    dispatch({ type: 'SUBMIT_WORD', player: me, word: w })
  }

  return (
    <div className="p-6 font-board">
      <div className="text-xl text-fg/60 mb-2">MEET IN THE MIDDLE</div>
      <div className="text-3xl uppercase mb-6">{shown[0]} + {shown[1]}</div>
      <input
        className="w-full min-h-[48px] text-2xl bg-fg text-bg px-3"
        value={word} onChange={(e) => { setWord(e.target.value); setErr('') }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        autoFocus
      />
      {err && <div className="text-accent text-xl mt-2">{err}</div>}
      <button className="mt-6 w-full min-h-[48px] bg-accent text-bg text-2xl" onClick={submit}>SUBMIT</button>
    </div>
  )
}
```

- [ ] **Step 4: Implement Play shell**

`src/play/Play.tsx`:
```tsx
import { useSession, useMyPlayerId } from '../net/playroom'
import { PlayJoin } from './phases/PlayJoin'
import { PlayMeldType } from './phases/PlayMeldType'
import { PlayWaiting } from './phases/PlayWaiting'

export function Play() {
  const s = useSession()
  const me = useMyPlayerId()
  if (!me) return <PlayWaiting label="CONNECTING…" />
  switch (s.phase) {
    case 'JOIN': return <PlayJoin me={me} joined={s.players[me].connected} />
    case 'MELD_TYPE': return <PlayMeldType s={s} me={me} />
    case 'MELD_REVEAL': return <PlayWaiting label="…" />
    case 'MELD_RESULT': return <PlayWaiting label="SEE THE SCREEN" />
    case 'DONE': return <PlayWaiting label="THAT'S THE ROUND" />
    default: return <PlayWaiting label="SEE THE SCREEN" />
  }
}
```

- [ ] **Step 5: Finalize App routing**

`src/App.tsx` (final form for M1):
```tsx
import { useEffect, useState } from 'react'
import { initNet, useIsStreamScreen } from './net/playroom'
import { Screen } from './screen/Screen'
import { Play } from './play/Play'

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => { initNet().then(() => setReady(true)) }, [])
  if (!ready) return <div className="p-8 font-board text-2xl">connecting…</div>
  return useIsStreamScreen() ? <Screen /> : <Play />
}
```

- [ ] **Step 6: Manual end-to-end verify**

Run: `npm run dev`. Open desktop (screen) + two phones. Name and JOIN both → screen enters MELD_TYPE. Submit a word on each phone → screen reveals both simultaneously; a non-match advances to round 2 automatically; a match centres the word and shows the result chain. Confirm the "already said" rejection by retyping a used word.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(play): mind meld phone renderers with already-said guard"
```

---

### Task 1.3: Debug harness + localStorage identity, then the M1 play-test gate

**Files:**
- Create: `src/debug/DebugBar.tsx`
- Modify: `src/screen/Screen.tsx` (mount DebugBar when `?debug=1`), `src/net/playroom.ts` (persist `{playroomId→PlayerId}` mapping to localStorage; expose debug dispatch helpers)

**Interfaces:**
- Consumes: `dispatch`, `useSession` (0.4).
- Produces: a `?debug=1` overlay on the screen with: **skip-phase** (dispatch TIMEOUT), **force-reveal** (fill both current words then TIMEOUT to reveal), **fill-both-players** (submit two distinct dummy words), **phase-jump** menu (host re-broadcasts a state with a chosen phase). localStorage persistence so a refreshed phone keeps its A/B identity.

**Rationale (spec):** "Reaching Act III by hand every time is the single biggest tax on iteration speed. Build this on day one." M1 has few phases, but the harness pattern is established here and reused by every later milestone.

- [ ] **Step 1: Persist identity mapping**

In `src/net/ids.ts`, back the `map` with `localStorage` (key `cp:ids`), loading on module init and saving on each `assignPlayerId`. On a phone reload, `myPlayer().id` returns the same Playroom id, so the same PlayerId is restored — no re-JOIN screen if already connected.

- [ ] **Step 2: Implement DebugBar**

`src/debug/DebugBar.tsx`:
```tsx
import type { SessionState } from '../engine/state'
import { dispatch } from '../net/playroom'

export function DebugBar({ s }: { s: SessionState }) {
  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex gap-2 text-sm font-board bg-fg/10 p-2">
      <button className="px-3 py-1 bg-fg/20" onClick={() => dispatch({ type: 'TIMEOUT' })}>skip-phase</button>
      <button className="px-3 py-1 bg-fg/20" onClick={() => {
        dispatch({ type: 'SUBMIT_WORD', player: 'A', word: 'debugone' })
        dispatch({ type: 'SUBMIT_WORD', player: 'B', word: 'debugtwo' })
      }}>fill-both</button>
      <button className="px-3 py-1 bg-fg/20" onClick={() => {
        dispatch({ type: 'SUBMIT_WORD', player: 'A', word: 'samesame' })
        dispatch({ type: 'SUBMIT_WORD', player: 'B', word: 'samesame' })
      }}>force-converge</button>
      <span className="px-2 py-1">phase: {s.phase}</span>
    </div>
  )
}
```

- [ ] **Step 3: Mount DebugBar on `?debug=1`**

In `src/screen/Screen.tsx`, read `new URLSearchParams(location.search).get('debug') === '1'` and conditionally render `<DebugBar s={s} />`.

- [ ] **Step 4: Manual verify the harness**

Run: `npm run dev` with `http://localhost:5173/?debug=1` on the screen. Join two phones. Use `force-converge` → screen should reveal a match and go to result. Use `skip-phase` to step through. Reload a phone mid-session → it returns to its current phase as the same player without a JOIN screen.

- [ ] **Step 5: THE M1 GATE — play it for real**

This is the spec's real gate. Play Mind Meld **four times in a row with a second person** (your partner) on a real phone + laptop, with no styling beyond the greybox. Do not proceed to M2 planning until:
- The reveal produces an involuntary noise at least once, AND
- Neither player has to be asked to play the next round.

Record the outcome honestly. If it is silent and dutiful, the problem is upstream of the whole build (per the spec) — stop and reconsider the core loop, not the code.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(debug): ?debug=1 harness + localStorage identity; M1 playable"
```

---

## PART B — Milestone roadmap (M2–M5)

These milestones are **not** expanded into bite-sized tasks here, deliberately: the spec mandates "do not start the next until the current has been played with a real second person," and warns against writing content and UI for loops that the play-test may change. **Each milestone below becomes its own full plan (via the writing-plans skill) once the previous gate is passed.** This section records scope and the gate so nothing is lost.

### M2 — The Pot
- Add `FORFEIT_WRITE` (45s, 5 lockable fields/phone, counters on screen, never contents), `POT_SHUFFLE` (4s screen-only card animation), and the pot region wired to real `forfeits`.
- New actions: `SUBMIT_FORFEITS`. House-forfeit top-up from `packs/list.json` when pot < 6. `authoredBy` recorded, never shown.
- Wire burn-on-converge into Act I: converge in ≤3 → one random forfeit `burned`.
- Reducer changes are pure and TDD'd exactly as in Task 0.3.
- **Gate:** burning a forfeit produces a reaction.

### M3 — Shortlist (built before The Gap, per spec — no content bank, novel interaction)
- `LIST_WRITE` (60s, 7 author fields), `LIST_SWAP` (20s, ranker replaces one — the always-reachable veto), `LIST_PLACE` (7× 15s one-at-a-time irreversible placement grid; author predicts, ranker commits; screen shows occupancy never contents), `LIST_REVEAL` (actual vs predicted, total displacement 0–24 with the four-band scoring).
- New actions: `SUBMIT_ITEMS`, `SWAP_ITEM`, `PLACE_ITEM`. Run twice, roles swapped.
- `packs/list.json` with 8 themes (I draft placeholder themes) + `packs:check` validation script + CI.
- **Gate:** the pair argue about the resulting order, not the score.

### M4 — The Gap
- `GAP_STATEMENT` (3s), `GAP_INPUT` (20s, subject 1–7 slider + LIE toggle, guesser slider), `GAP_CALL` (6s, guesser CALL, subject blind waiting), `GAP_REVEAL` (7s two-pin line), `GAP_RESULT` (6s). The lie (exactly once, forced on round 6 if unspent), the call's three outcomes (correct +3 / wrong subject +1 & button dead / never-called guesser −2).
- New actions: `SUBMIT_RATING` (carries slider + lie flag as one submission), `TOGGLE_LIE`, `CALL`. Run twice, roles swapped. Statement selection: 4 light + 2 spicy, spicy never round 1.
- `packs/gap.json` grown to 20 statements (I draft placeholders). The slider is the one interaction worth overspending on (7 detents, snapping, haptic).
- **Gate:** the guesser hovers over CALL and doesn't press.

### M5 — Tail & polish
- **Doubling** as a global layer (DOUBLE button on `GAP_CALL`, `LIST_PLACE` final item, `MELD_TYPE` round 4+; first press wins; announced with presser's name before the reveal; capped by pot). New action: `DOUBLE`.
- **Sudden death** (only when forfeit count level; one Gap statement, closest slider takes the pot; split on exact tie).
- **Souvenir** (terminal, untimed, one screen no-scroll at 16:9 and phone aspect; who owes what / the word / biggest gap / burned; typographic only) + standalone `?souvenir=<sessionId>` route.
- **Reconnection hardening** (heartbeat, `connected:false` after 10s silence without pausing, restore input on rejoin — `localStorage` identity already landed in M0/Task 1.3).
- Full content: 60 gap statements, 20 themes (I draft placeholders you replace).
- **The sports-board visual pass — one day, last.** If it takes a week, the constraint list has been abandoned.
- **Gate:** someone screenshots the end screen without being prompted.

---

## Self-review (against the spec)

- **Spec coverage (M0/M1):** stack, repo layout, pure reducer, content-in-packs, absolute-timestamp clock, auto-advance, Stream Mode transport, `?debug=1` harness, localStorage identity, Act I loop (type/reveal/result), matching rules (strict, plural fold), round cap 7, converge threshold recorded (burn deferred to M2 per spec), repeat-word rejection, double-timeout early end, `meldWords` accumulation, JOIN-until-both, greybox visual language — all mapped to Tasks 0.1–1.3. ✅
- **Deferred by spec's own build order:** forfeits/pot (M2), burn effect (M2), Acts II/III, doubling, sudden death, souvenir, reconnection hardening, full content, visual pass — captured in Part B. ✅
- **Placeholder scan:** engine code and tests are complete; net/UI code is complete greybox (not stubs). The one flagged uncertainty (exact Playroom name accessor / RPC mode spelling) is contained in Task 0.4 with an explicit verify-against-typings step and a manual gate that surfaces it immediately. ✅
- **Type consistency:** `reduce(state, action, now)`, `useSession(): SessionState`, `dispatch(action)`, `PlayerId`, `MeldResult.seedPair`, `meld.rounds` 1-based indexing, `useMyPlayerId()` used consistently across net/screen/play. ✅
- **Deviations, documented:** `isStreamScreen()` split, `isHost()` authority, `MeldResult.seedPair`, `SessionState.seedWords`, `Phase 'DONE'` M1 terminal, control action `JOIN`. All noted at point of use. ✅
