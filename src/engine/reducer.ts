import type { Action, DrawGame, DrawStroke, FingerGame, ListAct, ListItem, PlayerId, SessionState, WaveGame } from './state'
import { other } from './state'
import { isMatch } from './match'
import { makeRng, pick, shuffled } from './rng'
import { DRAW, DURATIONS, FINGER, LIST, WAVE } from './phases'
import { lowestFreeSlot, usedSlots } from './list'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

// ---------------------------------------------------------------- Act III · Shortlist

function currentList(state: SessionState): ListAct | undefined {
  return state.listActs[state.listActs.length - 1]
}

// Seeded so a session stays reproducible, and offset per run so the second author never
// draws the first one's theme.
function pickTheme(state: SessionState, run: number): string {
  const used = new Set(state.listActs.map((a) => a.themeId))
  const pool = state.themes.filter((t) => !used.has(t.id))
  if (pool.length === 0) return state.themes[0]?.id ?? ''
  return pick(makeRng((state.seed ^ 0x1157) + run), pool).id
}

function beginList(state: SessionState, now: number, author: PlayerId): SessionState {
  const s = clone(state)
  const themeId = pickTheme(s, s.listActs.length)
  const theme = s.themes.find((t) => t.id === themeId)
  const drawn = shuffled(makeRng((s.seed ^ 0x7331) + s.listActs.length), theme?.pool ?? [])
    .slice(0, LIST.items)
  const items: ListItem[] = drawn.map((text, i) => ({
    id: `${author}${i}`,
    text,
    actualSlot: null,
    predictedSlot: null,
  }))
  // A theme whose pool comes up short of seven still needs seven slots filled.
  while (items.length < LIST.items) {
    items.push({ id: `${author}${items.length}`, text: LIST.blank, actualSlot: null, predictedSlot: null })
  }
  s.listActs.push({ author, themeId, items, placeIndex: 0, revealIndex: 0, displacement: null })
  // The theme card first: both phones show the same thing, nobody is asked for
  // anything, and the first item doesn't land on someone still reading the theme.
  s.phase = 'LIST_INTRO'
  s.phaseEndsAt = now + DURATIONS.LIST_INTRO!
  return s
}

function toListPlace(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.phase = 'LIST_PLACE'
  s.phaseEndsAt = now + DURATIONS.LIST_PLACE!
  return s
}

function toReveal(state: SessionState): SessionState {
  const s = clone(state)
  const act = currentList(s)!
  act.displacement = act.items.reduce(
    (sum, i) => sum + Math.abs((i.actualSlot ?? 0) - (i.predictedSlot ?? 0)),
    0,
  )
  act.revealIndex = 0
  s.phase = 'LIST_REVEAL'
  // No clock. The reveal goes item by item on a tap, so nothing cuts an argument short.
  s.phaseEndsAt = null
  return s
}

// One tap walks the reveal to the next item, or off the end of the act. Either player
// can drive it — they're looking at the same list.
function advanceReveal(state: SessionState, now: number): SessionState {
  const act = currentList(state)
  if (!act) return state
  if (act.revealIndex >= act.items.length - 1) return afterListReveal(state, now)
  const s = clone(state)
  currentList(s)!.revealIndex += 1
  return s
}

const bothPlaced = (item: ListItem): boolean =>
  item.actualSlot !== null && item.predictedSlot !== null

// The live item is locked on both sides — move to the next one, or to the reveal once
// all seven are done.
function advancePlace(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const act = currentList(s)!
  if (act.placeIndex >= act.items.length - 1) return toReveal(s)
  act.placeIndex += 1
  s.phaseEndsAt = now + DURATIONS.LIST_PLACE!
  return s
}

// Whoever didn't lock the live item in time gets its lowest free slot — the same thing
// a distracted phone would land on anyway.
function timeoutPlace(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const act = currentList(s)!
  const item = act.items[act.placeIndex]
  if (item.predictedSlot === null) item.predictedSlot = lowestFreeSlot(act, true)
  if (item.actualSlot === null) item.actualSlot = lowestFreeSlot(act, false)
  return advancePlace(s, now)
}

// Act III runs twice, roles swapped. After the second run, 'full' carries on into the
// rest of the roster; any standalone game ends here.
function afterListReveal(state: SessionState, now: number): SessionState {
  const first = state.listActs[0]
  if (state.listActs.length < 2) return beginList(state, now, other(first.author))
  return state.game === 'full' ? beginFinger(state, now) : finishSession(state)
}

function finishSession(state: SessionState): SessionState {
  const s = clone(state)
  s.phase = 'DONE'
  s.phaseEndsAt = null
  return s
}

// ---------------------------------------------------------------- Put a Finger Down

function currentFingerRound(f: FingerGame) {
  return f.rounds[f.current]
}

function beginFinger(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const pool = shuffled(makeRng(s.seed ^ 0x9001), s.fingerStatements)
  const rounds = pool.slice(0, FINGER.rounds).map((statementId, i) => ({
    index: i + 1,
    statementId,
    applies: { A: null, B: null } as Record<PlayerId, boolean | null>,
  }))
  s.finger = { rounds, current: 0, fingersLeft: { A: FINGER.startFingers, B: FINGER.startFingers } }
  s.phase = 'FINGER_ROUND'
  s.phaseEndsAt = now + DURATIONS.FINGER_ROUND!
  return s
}

// A statement nobody answered in time counts as "doesn't apply" for both — an unopened
// hand, not a forced confession.
function toFingerReveal(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const f = s.finger!
  const round = currentFingerRound(f)
  for (const p of ['A', 'B'] as const) {
    if (round.applies[p]) f.fingersLeft[p] = Math.max(0, f.fingersLeft[p] - 1)
  }
  s.phase = 'FINGER_REVEAL'
  s.phaseEndsAt = now + DURATIONS.FINGER_REVEAL!
  return s
}

// Five statements, then it's over — least fingers down wins, not first to zero.
function advanceFinger(state: SessionState, now: number): SessionState {
  const f = state.finger!
  if (f.current >= FINGER.rounds - 1) {
    const s = clone(state)
    s.phase = 'FINGER_RESULT'
    s.phaseEndsAt = now + DURATIONS.FINGER_RESULT!
    return s
  }
  const s = clone(state)
  s.finger!.current += 1
  s.phase = 'FINGER_ROUND'
  s.phaseEndsAt = now + DURATIONS.FINGER_ROUND!
  return s
}

// ---------------------------------------------------------------- Wavelength

function currentWaveRound(w: WaveGame) {
  return w.rounds[w.current]
}

// Generated in full up front — spectrum, psychic and hidden target for every round —
// the same way Put a Finger Down pre-picks its five statements, and for the same
// reason: exactly WAVE.rounds rounds happen, no branching on how any of them go.
function beginWave(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const rng = makeRng(s.seed ^ 0xa001)
  const spectrums = shuffled(rng, s.spectrums)
  const rounds = Array.from({ length: WAVE.rounds }, (_, i) => {
    const spectrum = spectrums[i % Math.max(spectrums.length, 1)]
    const span = WAVE.targetMax - WAVE.targetMin
    return {
      index: i + 1,
      psychic: (i % 2 === 0 ? 'A' : 'B') as PlayerId,
      spectrumId: spectrum?.id ?? '',
      target: WAVE.targetMin + Math.round(rng() * span),
      clue: null,
      guess: null,
      distance: null,
    }
  })
  s.wave = { rounds, current: 0 }
  s.phase = 'WAVE_CLUE'
  s.phaseEndsAt = now + DURATIONS.WAVE_CLUE!
  return s
}

function toWaveGuess(state: SessionState, now: number, clue: string): SessionState {
  const s = clone(state)
  currentWaveRound(s.wave!).clue = clue
  s.phase = 'WAVE_GUESS'
  s.phaseEndsAt = now + DURATIONS.WAVE_GUESS!
  return s
}

function toWaveReveal(state: SessionState, now: number, guess: number): SessionState {
  const s = clone(state)
  const round = currentWaveRound(s.wave!)
  round.guess = guess
  round.distance = Math.abs(round.target - guess)
  s.phase = 'WAVE_REVEAL'
  s.phaseEndsAt = now + DURATIONS.WAVE_REVEAL!
  return s
}

// Seven rounds, then it's over — the official 2-player co-op variant's own length.
function advanceWave(state: SessionState, now: number): SessionState {
  const w = state.wave!
  if (w.current >= WAVE.rounds - 1) {
    const s = clone(state)
    s.phase = 'WAVE_RESULT'
    s.phaseEndsAt = now + DURATIONS.WAVE_RESULT!
    return s
  }
  const s = clone(state)
  s.wave!.current += 1
  s.phase = 'WAVE_CLUE'
  s.phaseEndsAt = now + DURATIONS.WAVE_CLUE!
  return s
}

// ---------------------------------------------------------------- Quick Draw

function currentDrawRound(d: DrawGame) {
  return d.rounds[d.current]
}

// Generated in full up front — prompt and drawer for every round — the same way Put a
// Finger Down and Wavelength pre-pick their whole schedule.
function beginDraw(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const rng = makeRng(s.seed ^ 0xd001)
  const prompts = shuffled(rng, s.drawPrompts)
  const rounds = Array.from({ length: DRAW.rounds }, (_, i) => ({
    index: i + 1,
    drawer: (i % 2 === 0 ? 'A' : 'B') as PlayerId,
    promptId: prompts[i % Math.max(prompts.length, 1)]?.id ?? '',
    strokes: [] as DrawStroke[],
    guess: null,
    correct: null,
  }))
  s.draw = { rounds, current: 0 }
  s.phase = 'DRAW_SKETCH'
  s.phaseEndsAt = now + DURATIONS.DRAW_SKETCH!
  return s
}

function toDrawGuess(state: SessionState, now: number, strokes: DrawStroke[]): SessionState {
  const s = clone(state)
  currentDrawRound(s.draw!).strokes = strokes
  s.phase = 'DRAW_GUESS'
  s.phaseEndsAt = now + DURATIONS.DRAW_GUESS!
  return s
}

function toDrawReveal(state: SessionState, now: number, guess: string): SessionState {
  const s = clone(state)
  const round = currentDrawRound(s.draw!)
  const prompt = s.drawPrompts.find((p) => p.id === round.promptId)
  round.guess = guess
  round.correct = isMatch(guess, prompt?.text ?? null)
  s.phase = 'DRAW_REVEAL'
  s.phaseEndsAt = now + DURATIONS.DRAW_REVEAL!
  return s
}

// Six prompts, then it's over — three rounds each as the drawer.
function advanceDraw(state: SessionState, now: number): SessionState {
  const d = state.draw!
  if (d.current >= DRAW.rounds - 1) {
    const s = clone(state)
    s.phase = 'DRAW_RESULT'
    s.phaseEndsAt = now + DURATIONS.DRAW_RESULT!
    return s
  }
  const s = clone(state)
  s.draw!.current += 1
  s.phase = 'DRAW_SKETCH'
  s.phaseEndsAt = now + DURATIONS.DRAW_SKETCH!
  return s
}

export function reduce(state: SessionState, action: Action, now: number): SessionState {
  switch (action.type) {
    case 'JOIN': {
      const s = clone(state)
      s.players[action.player] = { name: action.name, connected: true }
      const both = s.players.A.connected && s.players.B.connected
      if (both && s.phase === 'JOIN') {
        // Straight into the first act. 'list'/'finger'/'wave'/'draw' skip to that one
        // game; 'full' runs the whole roster, starting with Shortlist.
        if (s.game === 'list') return beginList(s, now, 'A')
        if (s.game === 'finger') return beginFinger(s, now)
        if (s.game === 'wave') return beginWave(s, now)
        if (s.game === 'draw') return beginDraw(s, now)
        return beginList(s, now, 'A')
      }
      return s
    }
    case 'PLACE_ITEM': {
      if (state.phase !== 'LIST_PLACE') return state
      const act = currentList(state)
      if (!act) return state
      const item = act.items[act.placeIndex]
      const byAuthor = action.player === act.author
      const already = byAuthor ? item.predictedSlot !== null : item.actualSlot !== null
      if (already) return state // no changing your mind once it lands
      if (action.slot < 1 || action.slot > LIST.items) return state
      if (usedSlots(act, byAuthor).has(action.slot)) return state // spent on an earlier item
      const s = clone(state)
      const mine = currentList(s)!
      const mineItem = mine.items[mine.placeIndex]
      if (byAuthor) mineItem.predictedSlot = action.slot
      else mineItem.actualSlot = action.slot
      return bothPlaced(mineItem) ? advancePlace(s, now) : s
    }
    case 'SUBMIT_FINGER': {
      if (state.phase !== 'FINGER_ROUND') return state
      const f = state.finger
      if (!f) return state
      const round = currentFingerRound(f)
      if (round.applies[action.player] !== null) return state // no changing your mind
      const s = clone(state)
      const sr = currentFingerRound(s.finger!)
      sr.applies[action.player] = action.applies
      if (sr.applies.A !== null && sr.applies.B !== null) return toFingerReveal(s, now)
      return s
    }
    case 'SUBMIT_CLUE': {
      if (state.phase !== 'WAVE_CLUE') return state
      const w = state.wave
      if (!w) return state
      const round = currentWaveRound(w)
      if (action.player !== round.psychic || round.clue !== null) return state
      const text = action.text.trim().slice(0, WAVE.clueMaxLen)
      if (text.length === 0) return state
      return toWaveGuess(state, now, text)
    }
    case 'SUBMIT_GUESS': {
      if (state.phase !== 'WAVE_GUESS') return state
      const w = state.wave
      if (!w) return state
      const round = currentWaveRound(w)
      if (action.player !== other(round.psychic) || round.guess !== null) return state
      const value = Math.max(0, Math.min(100, Math.round(action.value)))
      return toWaveReveal(state, now, value)
    }
    case 'SUBMIT_DRAWING': {
      if (state.phase !== 'DRAW_SKETCH') return state
      const d = state.draw
      if (!d) return state
      const round = currentDrawRound(d)
      if (action.player !== round.drawer) return state
      return toDrawGuess(state, now, action.strokes)
    }
    case 'SUBMIT_DRAW_GUESS': {
      if (state.phase !== 'DRAW_GUESS') return state
      const d = state.draw
      if (!d) return state
      const round = currentDrawRound(d)
      if (action.player !== other(round.drawer) || round.guess !== null) return state
      const text = action.text.trim().slice(0, DRAW.guessMaxLen)
      return toDrawReveal(state, now, text)
    }
    case 'ADVANCE_REVEAL': {
      if (state.phase !== 'LIST_REVEAL') return state
      return advanceReveal(state, now)
    }
    case 'TIMEOUT': {
      switch (state.phase) {
        case 'LIST_INTRO': return toListPlace(state, now)
        case 'LIST_PLACE': return timeoutPlace(state, now)
        case 'LIST_REVEAL': return advanceReveal(state, now)
        case 'FINGER_ROUND': return toFingerReveal(state, now)
        case 'FINGER_REVEAL': return advanceFinger(state, now)
        // 'full' carries on into Wavelength; a standalone game ends here.
        case 'FINGER_RESULT': return state.game === 'full' ? beginWave(state, now) : finishSession(state)
        // A clue nobody gave still lets the round play out — a blind guess costs nothing
        // it wouldn't have anyway.
        case 'WAVE_CLUE': return toWaveGuess(state, now, currentWaveRound(state.wave!).clue ?? '(no clue)')
        // A guess nobody made defaults to dead centre — a genuinely neutral non-answer.
        case 'WAVE_GUESS': return toWaveReveal(state, now, currentWaveRound(state.wave!).guess ?? 50)
        case 'WAVE_REVEAL': return advanceWave(state, now)
        // 'full' carries on into Quick Draw; a standalone game ends here.
        case 'WAVE_RESULT': return state.game === 'full' ? beginDraw(state, now) : finishSession(state)
        // A drawing nobody finished still lets the round play out — sketching nothing.
        case 'DRAW_SKETCH': return toDrawGuess(state, now, currentDrawRound(state.draw!).strokes)
        // A guess nobody made just misses — an empty guess never accidentally matches.
        case 'DRAW_GUESS': return toDrawReveal(state, now, currentDrawRound(state.draw!).guess ?? '')
        case 'DRAW_REVEAL': return advanceDraw(state, now)
        case 'DRAW_RESULT': return finishSession(state)
        default: return state
      }
    }
    default:
      return state
  }
}
