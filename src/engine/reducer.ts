import type { Action, MeldResult, MeldRound, PlayerId, SessionState } from './state'
import { isMatch } from './match'
import { makeRng, pick } from './rng'
import { DURATIONS, MELD, FORFEIT } from './phases'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

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
      if (both && s.phase === 'JOIN') return beginForfeitWrite(s, now)
      return s
    }
    case 'SUBMIT_FORFEITS': {
      if (state.phase !== 'FORFEIT_WRITE') return state
      if (potCount(state, action.player) >= FORFEIT.targetEach) return state
      const s = clone(state)
      const id = `${action.player}${potCount(state, action.player)}`
      s.forfeits.push({ id, text: action.text, authoredBy: action.player, state: 'pot' })
      const bothFull = potCount(s, 'A') >= FORFEIT.targetEach && potCount(s, 'B') >= FORFEIT.targetEach
      return bothFull ? finishForfeitWrite(s, now) : s
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
