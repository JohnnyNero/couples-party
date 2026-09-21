import type { Action, FingerGame, ListAct, ListItem, MeldResult, MeldRound, PlayerId, SessionState, WaveGame } from './state'
import { other } from './state'
import { isMatch } from './match'
import { makeRng, pick, shuffled } from './rng'
import { DURATIONS, FINGER, LIST, MELD, WAVE } from './phases'
import { lowestFreeSlot, usedSlots } from './list'

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

function toMeldReveal(state: SessionState, now: number): SessionState {
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

// Mind Meld is a co-op warm-up: converging together is its own reward, but it does
// not touch the leaderboard (the competitive acts are what score).
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
  s.listActs.push({ author, themeId, items, placeIndex: 0, displacement: null })
  s.phase = 'LIST_PLACE'
  s.phaseEndsAt = now + DURATIONS.LIST_PLACE!
  return s
}

function toReveal(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const act = currentList(s)!
  act.displacement = act.items.reduce(
    (sum, i) => sum + Math.abs((i.actualSlot ?? 0) - (i.predictedSlot ?? 0)),
    0,
  )
  s.phase = 'LIST_REVEAL'
  s.phaseEndsAt = now + DURATIONS.LIST_REVEAL!
  return s
}

const bothPlaced = (item: ListItem): boolean =>
  item.actualSlot !== null && item.predictedSlot !== null

// The live item is locked on both sides — move to the next one, or to the reveal once
// all seven are done.
function advancePlace(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const act = currentList(s)!
  if (act.placeIndex >= act.items.length - 1) return toReveal(s, now)
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

// Act III runs twice, roles swapped. After the second run the session is out of built
// acts (Act II and the souvenir land in later milestones).
function afterListReveal(state: SessionState, now: number): SessionState {
  const first = state.listActs[0]
  if (state.listActs.length < 2) return beginList(state, now, other(first.author))
  return finishSession(state)
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

export function reduce(state: SessionState, action: Action, now: number): SessionState {
  switch (action.type) {
    case 'JOIN': {
      const s = clone(state)
      s.players[action.player] = { name: action.name, connected: true }
      const both = s.players.A.connected && s.players.B.connected
      if (both && s.phase === 'JOIN') {
        // No stake to agree on anymore — straight into the first act. 'list' skips to
        // Shortlist, 'finger' to Put a Finger Down, 'wave' to Wavelength; 'full' and
        // 'meld' start on Mind Meld.
        if (s.game === 'list') return beginList(s, now, 'A')
        if (s.game === 'finger') return beginFinger(s, now)
        if (s.game === 'wave') return beginWave(s, now)
        return beginMeld(s, now)
      }
      return s
    }
    case 'SUBMIT_WORD': {
      if (state.phase !== 'MELD_TYPE') return state
      const s = clone(state)
      const round = currentRound(s.meld!)
      round.words[action.player] = action.word
      s.meldWords.push(action.word)
      if (round.words.A !== null && round.words.B !== null) return toMeldReveal(s, now)
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
    case 'TIMEOUT': {
      switch (state.phase) {
        case 'MELD_TYPE': return toMeldReveal(state, now)
        case 'MELD_REVEAL': return advanceReveal(state, now)
        // 'meld' is meld-only: the session ends here instead of moving on to Shortlist.
        case 'MELD_RESULT': return state.game === 'meld' ? finishSession(state) : beginList(state, now, 'A')
        case 'LIST_PLACE': return timeoutPlace(state, now)
        case 'LIST_REVEAL': return afterListReveal(state, now)
        case 'FINGER_ROUND': return toFingerReveal(state, now)
        case 'FINGER_REVEAL': return advanceFinger(state, now)
        case 'FINGER_RESULT': return finishSession(state)
        // A clue nobody gave still lets the round play out — a blind guess costs nothing
        // it wouldn't have anyway.
        case 'WAVE_CLUE': return toWaveGuess(state, now, currentWaveRound(state.wave!).clue ?? '(no clue)')
        // A guess nobody made defaults to dead centre — a genuinely neutral non-answer.
        case 'WAVE_GUESS': return toWaveReveal(state, now, currentWaveRound(state.wave!).guess ?? 50)
        case 'WAVE_REVEAL': return advanceWave(state, now)
        case 'WAVE_RESULT': return finishSession(state)
        default: return state
      }
    }
    default:
      return state
  }
}
