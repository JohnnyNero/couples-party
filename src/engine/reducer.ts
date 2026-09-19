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
