# Couples Party — M2 (The Pot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the cold-open "Pot" — players write forfeits, the pot fills, and converging fast in Mind Meld burns one — so the game has stakes. Works in both screen and duo modes.

**Architecture:** Engine stays pure; the reducer gains the `FORFEIT_WRITE` → `POT_SHUFFLE` phases before Act I, a `SUBMIT_FORFEITS` action, house-forfeit top-up, and burn-on-converge. New per-phase renderers plug into the existing shared `BoardStage`/`Controller` maps, so screen and duo both get them for free.

**Tech Stack:** React + Vite + TS + Tailwind, Playroom Kit, Vitest. Unchanged from M0/M1.

**Spec:** `Two-Player Party Game — Build Spec.md` (repo root) — sections "Cold open — The Pot", "Act I — Mind Meld" (burn rules), "Content packs" (`packs/list.json`), "UI contract".

## Global Constraints

Every task's requirements implicitly include this section.

- **`src/engine/reducer.ts` imports nothing with side effects** — only `./state`, `./match`, `./rng`, `./phases`. No `Date.now()` (time via `now` arg) and no `Math.random()` (randomness only via the seeded `makeRng` over `state.seed`).
- **Content lives in `packs/*.json`**, loaded at boot and carried into the reducer via state fields — never hardcoded in engine logic.
- **No score field.** Standing is derived from `forfeits`.
- **`authoredBy` is never rendered.** Not in play, not anywhere.
- **Nothing private renders on the host screen / board.** `FORFEIT_WRITE` shows per-player *counts only*, never forfeit text.
- **Absolute-timestamp clock**; **auto-advance always**; no continue button.
- **Forfeits are drawn at random, never chosen** — the burn selects a random pot forfeit.
- **`src/net/playroom.ts` is the only file importing `playroomkit`.**
- Visual language: three colours (`bg`/`fg`/`accent`), `font-board`, tabular numerals, no icons/shadows/gradients/rounded corners; phone tap targets ≥ 48px.

## Flow after this milestone

```
JOIN → FORFEIT_WRITE (45s, +20s once if under min) → POT_SHUFFLE (4s) → ACT I (Mind Meld) → MELD_RESULT (burn if converged ≤3) → DONE
```

---

### Task 2.1: Engine — forfeits, the pot flow, and burn-on-converge (pure, TDD)

**Files:**
- Modify: `src/engine/state.ts` (Forfeit.authoredBy nullable; new SessionState fields; SUBMIT_FORFEITS action)
- Modify: `src/engine/phases.ts` (forfeit constants)
- Modify: `src/engine/reducer.ts` (new phases + action + burn)
- Modify: `src/engine/reducer.test.ts` (append M2 tests)

**Interfaces:**
- Consumes: existing `reduce`, `initialState`, `makeRng`, `pick`, `MELD`, `DURATIONS`.
- Produces:
  - `Forfeit.authoredBy: PlayerId | null` (null = house forfeit)
  - `SessionState` gains: `houseForfeits: string[]`, `forfeitWriteExtended: boolean`
  - `initialState(seed, seedWords?, houseForfeits?)` — third param defaults to `[]`
  - Action `{ type: 'SUBMIT_FORFEITS'; player: PlayerId; text: string }` (adds ONE forfeit — a single locked field; the name matches the spec's action vocabulary)
  - Constants in `phases.ts`: `FORFEIT = { targetEach: 5, minEach: 2, potFloor: 6, maxLen: 60 }`

**Behavior contract (spec "Cold open — The Pot" + Act I burn):**
- Both players connected in `JOIN` → begin `FORFEIT_WRITE`: `phaseEndsAt = now + DURATIONS.FORFEIT_WRITE`, `forfeitWriteExtended = false`.
- `SUBMIT_FORFEITS` (phase must be `FORFEIT_WRITE`): append `{ id, text, authoredBy: player, state: 'pot' }`. Ignore if that player already has 5 (`FORFEIT.targetEach`) pot forfeits. `id = ` `${player}${count}` where count is that player's current forfeit count (deterministic, unique). If, after appending, BOTH players have 5, advance immediately to `POT_SHUFFLE` (via the shared `finishForfeitWrite` path below).
- `TIMEOUT` in `FORFEIT_WRITE`: if either player has fewer than `FORFEIT.minEach` (2) AND `!forfeitWriteExtended` → set `forfeitWriteExtended = true`, `phaseEndsAt = now + 20000`, stay in `FORFEIT_WRITE`. Otherwise → `finishForfeitWrite`.
- `finishForfeitWrite(state, now)`: top up from `houseForfeits` until `forfeits.length >= FORFEIT.potFloor` (6) — each house forfeit `{ id: 'h<k>', text, authoredBy: null, state: 'pot' }`, cycling the house list; then phase `POT_SHUFFLE`, `phaseEndsAt = now + DURATIONS.POT_SHUFFLE`.
- `TIMEOUT` in `POT_SHUFFLE` → `beginMeld` (unchanged Act I start).
- Burn-on-converge: in `finalize`, if `converged && roundsTaken <= MELD.burnThreshold` (3) → set exactly one random `state:'pot'` forfeit to `'burned'`. Select with `makeRng(state.seed ^ 0x5f37)` (a stream distinct from the seed-pair pick) then `pick`; if no pot forfeits exist, burn nothing. Burned forfeits stay in the array.

- [ ] **Step 1: Write failing tests**

Append to `src/engine/reducer.test.ts`:
```ts
import { DEFAULT_SEEDS } from './state'

const HOUSE = ['makes the tea', 'picks the takeaway', 'loses aux', 'walks the dog']
const startForfeit = () => {
  let s = initialState(1, DEFAULT_SEEDS, HOUSE)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
  return s
}

describe('the pot — forfeit write', () => {
  it('both joined begins FORFEIT_WRITE, not meld', () => {
    const s = startForfeit()
    expect(s.phase).toBe('FORFEIT_WRITE')
    expect(s.phaseEndsAt).toBe(1000 + 45000)
    expect(s.forfeitWriteExtended).toBe(false)
    expect(s.meld).toBe(null)
  })
  it('SUBMIT_FORFEITS appends a pot forfeit authored by the player', () => {
    let s = startForfeit()
    s = reduce(s, { type: 'SUBMIT_FORFEITS', player: 'A', text: 'sings in the shower' }, 2000)
    expect(s.forfeits).toHaveLength(1)
    expect(s.forfeits[0]).toMatchObject({ text: 'sings in the shower', authoredBy: 'A', state: 'pot' })
  })
  it('ignores a 6th forfeit from the same player', () => {
    let s = startForfeit()
    for (let i = 0; i < 7; i++) s = reduce(s, { type: 'SUBMIT_FORFEITS', player: 'A', text: `f${i}` }, 2000)
    expect(s.forfeits.filter((f) => f.authoredBy === 'A')).toHaveLength(5)
  })
  it('both reaching 5 advances to POT_SHUFFLE immediately', () => {
    let s = startForfeit()
    for (const p of ['A', 'B'] as const)
      for (let i = 0; i < 5; i++) s = reduce(s, { type: 'SUBMIT_FORFEITS', player: p, text: `${p}${i}` }, 2000)
    expect(s.phase).toBe('POT_SHUFFLE')
  })
})

describe('the pot — timeout, extension, top-up', () => {
  it('extends once by 20s when under the minimum', () => {
    let s = startForfeit() // nobody submitted
    s = reduce(s, { type: 'TIMEOUT' }, 46000)
    expect(s.phase).toBe('FORFEIT_WRITE')
    expect(s.forfeitWriteExtended).toBe(true)
    expect(s.phaseEndsAt).toBe(46000 + 20000)
  })
  it('after the extension, proceeds and tops up the pot to the floor', () => {
    let s = startForfeit()
    s = reduce(s, { type: 'TIMEOUT' }, 46000) // extend
    s = reduce(s, { type: 'TIMEOUT' }, 67000) // proceed
    expect(s.phase).toBe('POT_SHUFFLE')
    expect(s.forfeits.length).toBeGreaterThanOrEqual(6)
    expect(s.forfeits.some((f) => f.authoredBy === null)).toBe(true) // house forfeits added
  })
  it('does not extend a second time', () => {
    let s = startForfeit()
    s = reduce(s, { type: 'TIMEOUT' }, 46000) // extend
    // one player now meets the min, the other does not — still must not extend again
    s = reduce(s, { type: 'SUBMIT_FORFEITS', player: 'A', text: 'x' }, 50000)
    s = reduce(s, { type: 'SUBMIT_FORFEITS', player: 'A', text: 'y' }, 50000)
    s = reduce(s, { type: 'TIMEOUT' }, 67000)
    expect(s.phase).toBe('POT_SHUFFLE')
  })
})

describe('the pot — POT_SHUFFLE and burn', () => {
  const toMeld = () => {
    let s = startForfeit()
    for (const p of ['A', 'B'] as const)
      for (let i = 0; i < 5; i++) s = reduce(s, { type: 'SUBMIT_FORFEITS', player: p, text: `${p}${i}` }, 2000)
    // now POT_SHUFFLE
    return reduce(s, { type: 'TIMEOUT' }, 3000) // POT_SHUFFLE -> MELD_TYPE
  }
  it('POT_SHUFFLE advances into Act I mind meld', () => {
    const s = toMeld()
    expect(s.phase).toBe('MELD_TYPE')
    expect(s.meld?.rounds).toHaveLength(1)
  })
  it('converging in <=3 rounds burns exactly one pot forfeit', () => {
    let s = toMeld()
    const potBefore = s.forfeits.filter((f) => f.state === 'pot').length
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'same' }, 4000)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'same' }, 4000)
    s = reduce(s, { type: 'TIMEOUT' }, 8000) // reveal -> result (converged round 1)
    expect(s.phase).toBe('MELD_RESULT')
    expect(s.forfeits.filter((f) => f.state === 'burned')).toHaveLength(1)
    expect(s.forfeits.filter((f) => f.state === 'pot')).toHaveLength(potBefore - 1)
  })
  it('no burn when convergence takes more than 3 rounds', () => {
    let s = toMeld()
    for (let r = 0; r < 3; r++) {
      s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: `a${r}` }, 100)
      s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: `b${r}` }, 100)
      s = reduce(s, { type: 'TIMEOUT' }, 100)
    }
    // round 4 converge
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'zz' }, 100)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'zz' }, 100)
    s = reduce(s, { type: 'TIMEOUT' }, 100)
    expect(s.meld?.converged).toBe(true)
    expect(s.meld?.roundsTaken).toBe(4)
    expect(s.forfeits.filter((f) => f.state === 'burned')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- reducer`
Expected: FAIL (new behavior not implemented; existing 8 reducer tests still pass).

- [ ] **Step 3: Update state.ts**

- Change `Forfeit.authoredBy` to `PlayerId | null` (update the type and its comment: `null = house forfeit`).
- Add to `SessionState`: `houseForfeits: string[]` and `forfeitWriteExtended: boolean`.
- Add `SUBMIT_FORFEITS` to the `Action` union: `| { type: 'SUBMIT_FORFEITS'; player: PlayerId; text: string }`.
- Change the factory signature and body:
```ts
export function initialState(
  seed: number,
  seedWords: string[] = DEFAULT_SEEDS,
  houseForfeits: string[] = [],
): SessionState {
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
    seedWords,
    houseForfeits,
    forfeitWriteExtended: false,
  }
}
```

- [ ] **Step 4: Update phases.ts**

Add:
```ts
export const FORFEIT = { targetEach: 5, minEach: 2, potFloor: 6, maxLen: 60 }
```

- [ ] **Step 5: Implement reducer changes**

In `src/engine/reducer.ts`:
- Import `FORFEIT` alongside `MELD`, `DURATIONS`.
- Add helpers (pure):
```ts
function potCount(state: SessionState, player: PlayerId): number {
  return state.forfeits.filter((f) => f.authoredBy === player).length
}

function beginForfeitWrite(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.phase = 'FORFEIT_WRITE'
  s.phaseEndsAt = now + DURATIONS.FORFEIT_WRITE!
  s.forfeitWriteExtended = false
  return s
}

function finishForfeitWrite(state: SessionState, now: number): SessionState {
  const s = clone(state)
  let k = 0
  while (s.forfeits.length < FORFEIT.potFloor && s.houseForfeits.length > 0) {
    const text = s.houseForfeits[k % s.houseForfeits.length]
    s.forfeits.push({ id: `h${k}`, text, authoredBy: null, state: 'pot' })
    k++
  }
  s.phase = 'POT_SHUFFLE'
  s.phaseEndsAt = now + DURATIONS.POT_SHUFFLE!
  return s
}
```
- In `beginMeld`: unchanged (still called from POT_SHUFFLE timeout).
- In `finalize`: after setting converged/roundsTaken/finalWord, add the burn:
```ts
if (meld.converged && meld.roundsTaken <= MELD.burnThreshold) {
  const burnRng = makeRng(s.seed ^ 0x5f37)
  const potIdx = s.forfeits
    .map((f, i) => (f.state === 'pot' ? i : -1))
    .filter((i) => i >= 0)
  if (potIdx.length > 0) {
    const chosen = pick(burnRng, potIdx)
    s.forfeits[chosen].state = 'burned'
  }
}
```
(Note: `finalize` currently clones `state` into `s` and mutates `s.meld`. Perform the burn on that same `s` after `meld` is updated, before returning.)
- In the `JOIN` case: replace the both-connected `beginMeld(s, now)` call with `beginForfeitWrite(s, now)`.
- Add a `SUBMIT_FORFEITS` case:
```ts
case 'SUBMIT_FORFEITS': {
  if (state.phase !== 'FORFEIT_WRITE') return state
  if (potCount(state, action.player) >= FORFEIT.targetEach) return state
  const s = clone(state)
  const id = `${action.player}${potCount(state, action.player)}`
  s.forfeits.push({ id, text: action.text, authoredBy: action.player, state: 'pot' })
  const bothFull = potCount(s, 'A') >= FORFEIT.targetEach && potCount(s, 'B') >= FORFEIT.targetEach
  return bothFull ? finishForfeitWrite(s, now) : s
}
```
- Extend the `TIMEOUT` switch:
```ts
case 'FORFEIT_WRITE': {
  const under = potCount(state, 'A') < FORFEIT.minEach || potCount(state, 'B') < FORFEIT.minEach
  if (under && !state.forfeitWriteExtended) {
    const s = clone(state)
    s.forfeitWriteExtended = true
    s.phaseEndsAt = now + 20000
    return s
  }
  return finishForfeitWrite(state, now)
}
case 'POT_SHUFFLE': return beginMeld(state, now)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- reducer`
Expected: PASS (new M2 tests + the original 8).

- [ ] **Step 7: Full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all green (note: `initialState` gained a param — confirm existing callers still compile; the net layer is updated in Task 2.2).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(engine): the pot — forfeit write, top-up, pot shuffle, burn-on-converge"
```

---

### Task 2.2: Content pack + boot wiring

**Files:**
- Create: `packs/list.json`
- Modify: `src/packs.ts` (load house forfeits)
- Modify: `src/net/playroom.ts` (pass house forfeits into `initialState`)

**Interfaces:**
- Consumes: `loadPacks` (extended), `initialState(seed, seedWords, houseForfeits)` (2.1).
- Produces: `loadPacks(): Promise<{ seedWords: string[]; houseForfeits: string[] }>`.

- [ ] **Step 1: Create `packs/list.json`**

Deliberately bland house forfeits (they pad a thin pot; their blandness makes player-written ones land). Themes included now for M3 reuse; unused this milestone.
```json
{
  "version": 1,
  "houseForfeits": [
    "makes the next round of tea",
    "picks up the next takeaway",
    "loses aux privileges for a day",
    "does the washing up tonight",
    "takes the bins out this week",
    "makes breakfast tomorrow"
  ],
  "themes": [
    { "id": "t001", "text": "seven things {name} would struggle to give up" },
    { "id": "t002", "text": "seven of {name}'s strongest opinions" },
    { "id": "t003", "text": "seven people {name} would call at 3am" },
    { "id": "t004", "text": "seven of {name}'s small fears" },
    { "id": "t005", "text": "seven things {name} always says" },
    { "id": "t006", "text": "seven of {name}'s guilty pleasures" },
    { "id": "t007", "text": "seven ways to annoy {name} instantly" },
    { "id": "t008", "text": "seven things {name} is secretly proud of" }
  ]
}
```

- [ ] **Step 2: Extend the packs loader**

`src/packs.ts`:
```ts
import gap from '../packs/gap.json'
import list from '../packs/list.json'

export async function loadPacks(): Promise<{ seedWords: string[]; houseForfeits: string[] }> {
  return {
    seedWords: (gap as { seedWords: string[] }).seedWords,
    houseForfeits: (list as { houseForfeits: string[] }).houseForfeits,
  }
}
```

- [ ] **Step 3: Pass house forfeits into state on the host**

In `src/net/playroom.ts`:
- Add a module var `let houseForfeits: string[] = []`.
- In `initNet`, after `const packs = await loadPacks()`: `seedWords = packs.seedWords; houseForfeits = packs.houseForfeits`.
- Update `hostFreshState()` to `return initialState(ensureSessionSeed(), seedWords, houseForfeits)`.
- Update `placeholderState()` to `return initialState(0, seedWords, houseForfeits)`.

- [ ] **Step 4: Typecheck, build, commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.
```bash
git add -A
git commit -m "feat(packs): house forfeits pack + boot wiring for the pot"
```

---

### Task 2.3: Renderers — forfeit write, pot shuffle, pot region

**Files:**
- Create: `src/screen/phases/ScreenForfeitWrite.tsx`, `src/screen/phases/ScreenPotShuffle.tsx`
- Create: `src/play/phases/PlayForfeitWrite.tsx`
- Modify: `src/views/board.tsx` (map new phases + rail text), `src/views/controller.tsx` (map new phases)
- Modify: `src/screen/Screen.tsx` and `src/duo/Duo.tsx` (pot region shows owed counts)

**Interfaces:**
- Consumes: `useSession`, `dispatch`, `SessionState`, `PlayerId`, `FORFEIT` (from `phases.ts`).
- Produces: board + controller views for `FORFEIT_WRITE` and `POT_SHUFFLE`.

- [ ] **Step 1: Screen — forfeit write (counts only, never text)**

`src/screen/phases/ScreenForfeitWrite.tsx`:
```tsx
import type { SessionState } from '../../engine/state'
import { FORFEIT } from '../../engine/phases'

export function ScreenForfeitWrite({ s }: { s: SessionState }) {
  const count = (p: 'A' | 'B') => s.forfeits.filter((f) => f.authoredBy === p).length
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="text-2xl sm:text-4xl font-bold uppercase tracking-tight mb-3">Write your forfeits</div>
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-8 sm:mb-12">
        What the loser has to do · {FORFEIT.targetEach} each
      </div>
      <div className="flex justify-center gap-12 sm:gap-20">
        <Counter name={s.players.A.name || 'Player A'} n={count('A')} />
        <Counter name={s.players.B.name || 'Player B'} n={count('B')} />
      </div>
    </div>
  )
}
function Counter({ name, n }: { name: string; n: number }) {
  return (
    <div>
      <div className="text-6xl sm:text-8xl font-bold tabular-nums leading-none">{n}<span className="text-fg/25 text-3xl sm:text-5xl">/{FORFEIT.targetEach}</span></div>
      <div className="mt-3 text-sm sm:text-lg uppercase tracking-widest text-fg/60">{name}</div>
    </div>
  )
}
```

- [ ] **Step 2: Screen — pot shuffle (the one animation)**

`src/screen/phases/ScreenPotShuffle.tsx` — ten cards animating into a pile; count visible, contents not. Add a keyframe via a `<style>` tag (greybox-simple, self-contained):
```tsx
import type { SessionState } from '../../engine/state'

export function ScreenPotShuffle({ s }: { s: SessionState }) {
  const n = s.forfeits.length
  return (
    <div className="w-full text-center">
      <style>{`
        @keyframes cp-drop { from { transform: translateY(-60px) rotate(var(--r)); opacity: 0 } to { transform: translateY(0) rotate(var(--r)); opacity: 1 } }
      `}</style>
      <div className="relative h-40 sm:h-56 flex items-center justify-center">
        {Array.from({ length: n }).map((_, i) => (
          <div
            key={i}
            className="absolute h-28 w-20 sm:h-40 sm:w-28 border-2 border-fg/70 bg-bg"
            style={{
              // deterministic scatter so it reads as a pile, not a fan
              ['--r' as string]: `${((i * 37) % 13) - 6}deg`,
              transform: `translateX(${((i * 29) % 40) - 20}px) rotate(${((i * 37) % 13) - 6}deg)`,
              animation: `cp-drop 400ms ease-out ${i * 90}ms both`,
            }}
          />
        ))}
      </div>
      <div className="mt-6 text-3xl sm:text-5xl font-bold uppercase tracking-tight">Pot {n}</div>
    </div>
  )
}
```

- [ ] **Step 3: Phone — forfeit write (5 lockable fields, rotating placeholder)**

`src/play/phases/PlayForfeitWrite.tsx`:
```tsx
import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { FORFEIT } from '../../engine/phases'
import { dispatch } from '../../net/playroom'
import { PlayWaiting } from './PlayWaiting'

const PLACEHOLDERS = [
  'makes coffee for a week',
  'loses aux for a day',
  'texts their mum a compliment',
  'does the dishes all week',
  'gives up the good pillow',
]

export function PlayForfeitWrite({ s, me }: { s: SessionState; me: PlayerId }) {
  const mine = s.forfeits.filter((f) => f.authoredBy === me).length
  const [text, setText] = useState('')
  if (mine >= FORFEIT.targetEach) return <PlayWaiting label="All five in — waiting" />

  const submit = () => {
    const t = text.trim()
    if (t.length === 0) return
    dispatch({ type: 'SUBMIT_FORFEITS', player: me, text: t })
    setText('')
  }

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-1">The loser has to…</div>
        <div className="text-lg uppercase tracking-widest text-fg/70">
          {mine} of {FORFEIT.targetEach} written
        </div>
      </div>
      <input
        className="w-full min-h-[56px] text-lg bg-fg text-bg px-4 outline-none border-b-4 border-accent placeholder:text-bg/30"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        maxLength={FORFEIT.maxLen}
        placeholder={PLACEHOLDERS[mine] ?? 'something they have to do'}
        autoComplete="off"
      />
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={submit}
      >
        Lock it in
      </button>
      <div className="flex gap-2 justify-center pt-1">
        {Array.from({ length: FORFEIT.targetEach }).map((_, i) => (
          <span key={i} className={'h-3 w-3 ' + (i < mine ? 'bg-accent' : 'border-2 border-fg/30')} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire the new phases into the shared maps**

In `src/views/board.tsx`:
- Import `ScreenForfeitWrite`, `ScreenPotShuffle`.
- Add cases: `case 'FORFEIT_WRITE': return <ScreenForfeitWrite s={s} />` and `case 'POT_SHUFFLE': return <ScreenPotShuffle s={s} />`.
- Update `railText`: `if (s.phase === 'FORFEIT_WRITE') return 'The Pot · Write your forfeits'`; `if (s.phase === 'POT_SHUFFLE') return 'The Pot'`.

In `src/views/controller.tsx`:
- Import `PlayForfeitWrite`.
- Add cases: `case 'FORFEIT_WRITE': return <PlayForfeitWrite s={s} me={me} />` and `case 'POT_SHUFFLE': return <PlayWaiting label="Shuffling the pot…" />`.

- [ ] **Step 5: Pot region shows owed counts**

In `src/screen/Screen.tsx`, replace the `Pot` component body so it shows the pot count and each player's owed count:
```tsx
function Pot({ s }: { s: SessionState }) {
  const pot = s.forfeits.filter((f) => f.state === 'pot').length
  const owed = (p: 'A' | 'B') => s.forfeits.filter((f) => f.state === 'owed' && f.owedBy === p).length
  return (
    <div className="flex items-end gap-6 sm:gap-10">
      <div>
        <div className="text-xs uppercase tracking-widest text-fg/40">Pot</div>
        <div className="text-4xl sm:text-5xl font-bold tabular-nums leading-none">{pot}</div>
      </div>
      <div className="text-sm sm:text-base uppercase tracking-wider text-fg/60 tabular-nums">
        <div>{(s.players.A.name || 'A')} owes {owed('A')}</div>
        <div>{(s.players.B.name || 'B')} owes {owed('B')}</div>
      </div>
    </div>
  )
}
```
In `src/duo/Duo.tsx`, update `PotInline` to also show owed counts compactly:
```tsx
function PotInline({ s }: { s: SessionState }) {
  const pot = s.forfeits.filter((f) => f.state === 'pot').length
  return <span className="uppercase">Pot <span className="tabular-nums text-fg">{pot}</span></span>
}
```
(Owed counts stay 0 through M2; the screen shows them, the duo strip keeps just the pot for space.)

- [ ] **Step 6: Typecheck, build, commit**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: clean; 35+ tests pass.
```bash
git add -A
git commit -m "feat(ui): forfeit-write, pot-shuffle animation, pot region owed counts (screen + duo)"
```

---

### Task 2.4: Debug helper + manual checkpoint

**Files:**
- Modify: `src/debug/DebugBar.tsx`

**Interfaces:**
- Consumes: `dispatch`, `FORFEIT`.

- [ ] **Step 1: Add a fill-forfeits button**

In `src/debug/DebugBar.tsx`, add a button that fills both players to the target so you can skip the write phase fast:
```tsx
<button
  className={btn}
  onClick={() => {
    for (const p of ['A', 'B'] as const)
      for (let i = 0; i < 5; i++) dispatch({ type: 'SUBMIT_FORFEITS', player: p, text: `${p} forfeit ${i}` })
  }}
>
  fill-pot
</button>
```
(Keep the existing skip / fill-both / converge buttons and the phase readout.)

- [ ] **Step 2: Typecheck, build, commit**

Run: `npx tsc --noEmit && npm run build`
```bash
git add -A
git commit -m "feat(debug): fill-pot helper for skipping forfeit write"
```

- [ ] **Step 3: MANUAL CHECKPOINT (human)**

On the live URL (or `npm run dev`), in either mode: both players write forfeits → counts rise on the board (never the text) → pot shuffles → play Mind Meld → converge in ≤3 → the pot count drops by one and the board reflects the burn. Confirm nothing shows a forfeit's text on the board, and `authoredBy` never appears.
*Done when:* burning a forfeit produces a reaction (the spec's M2 gate).

---

## Self-review (against the spec)

- **Spec coverage (M2):** FORFEIT_WRITE 45s + counts-only board ✅; 5 lockable fields + rotating placeholder + 60-char cap ✅ (2.3); target 5 / min 2 / +20s once ✅ (2.1); pot floor 6 via house top-up ✅ (2.1/2.2); POT_SHUFFLE 4s screen-only animation ✅ (2.3); authoredBy recorded never rendered ✅ (constraint + counts-only views); forfeits drawn at random for the burn ✅ (2.1); burn-on-converge ≤3 ✅ (2.1); pot region with owed counts ✅ (2.3); both screen + duo via shared maps ✅. 
- **Deviations, documented:** `Forfeit.authoredBy: PlayerId | null` (null = house) — necessary since house forfeits have no author; still never rendered. `SUBMIT_FORFEITS` carries a single `text` (one locked field) though named plural — matches the spec's action vocabulary.
- **Placeholder scan:** engine + tests are complete; UI code complete; content pack is real placeholder comedy (to be replaced by the user).
- **Type consistency:** `initialState(seed, seedWords, houseForfeits)`, `SUBMIT_FORFEITS`, `FORFEIT` constants, `authoredBy: PlayerId | null`, `finishForfeitWrite`/`beginForfeitWrite` used consistently across engine and net.
- **Purity:** burn uses `makeRng(state.seed ^ 0x5f37)` — seeded, no `Math.random`/`Date.now` in the reducer.
