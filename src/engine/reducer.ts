import type { Action, ListAct, MeldResult, MeldRound, PlayerId, SessionState } from './state'
import { other } from './state'
import { isMatch } from './match'
import { makeRng, pick, shuffled } from './rng'
import { DURATIONS, LIST, MELD } from './phases'
import { currentItem, lowestFreeSlot, slotOf, usedSlots } from './list'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function beginStakeSet(state: SessionState): SessionState {
  const s = clone(state)
  s.phase = 'STAKE_SET'
  s.phaseEndsAt = null // untimed: agree, then type it in
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
// not touch the single session stake (the competitive acts decide who owes it).
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
  s.listActs.push({
    author,
    themeId: pickTheme(s, s.listActs.length),
    items: [],
    placeIndex: 0,
    swapDone: false,
    displacement: null,
  })
  s.phase = 'LIST_WRITE'
  s.phaseEndsAt = now + DURATIONS.LIST_WRITE!
  return s
}

// Seven slots need seven items, so a short list is padded on timeout. The blanks are
// visible and rankable — hiding them would be worse than owning them.
function padItems(act: ListAct): void {
  while (act.items.length < LIST.items) {
    act.items.push({
      id: `${act.author}${act.items.length}`,
      text: LIST.blank,
      swapped: false,
      actualSlot: null,
      predictedSlot: null,
    })
  }
}

function beginSwap(state: SessionState, now: number): SessionState {
  const s = clone(state)
  padItems(currentList(s)!)
  s.phase = 'LIST_SWAP'
  s.phaseEndsAt = now + DURATIONS.LIST_SWAP!
  return s
}

// The items go into reveal order only once the veto has closed: the ranker judges the
// authored order, then neither player controls what comes up when.
function beginPlace(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const act = currentList(s)!
  act.swapDone = true
  act.items = shuffled(makeRng((s.seed ^ 0x5157) + s.listActs.length), act.items)
  act.placeIndex = 0
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

// Both committed (or timed out): on to the next item, or to the reveal after the seventh.
function advancePlace(state: SessionState, now: number): SessionState {
  const act = currentList(state)!
  if (act.placeIndex >= LIST.items - 1) return toReveal(state, now)
  const s = clone(state)
  currentList(s)!.placeIndex += 1
  s.phase = 'LIST_PLACE'
  s.phaseEndsAt = now + DURATIONS.LIST_PLACE!
  return s
}

function timeoutPlace(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const act = currentList(s)!
  const item = currentItem(act)!
  // A timed-out placement takes the lowest-numbered free slot, per player.
  if (item.actualSlot === null) item.actualSlot = lowestFreeSlot(act, false)
  if (item.predictedSlot === null) item.predictedSlot = lowestFreeSlot(act, true)
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

export function reduce(state: SessionState, action: Action, now: number): SessionState {
  switch (action.type) {
    case 'JOIN': {
      const s = clone(state)
      s.players[action.player] = { name: action.name, connected: true }
      const both = s.players.A.connected && s.players.B.connected
      if (both && s.phase === 'JOIN') {
        // 'meld' is a co-op-only game: no forfeit, so no stake to agree first.
        return s.game === 'meld' ? beginMeld(s, now) : beginStakeSet(s)
      }
      return s
    }
    case 'SET_STAKE': {
      if (state.phase !== 'STAKE_SET') return state
      const text = action.text.trim()
      if (text.length === 0 || state.stake !== null) return state // first non-empty wins
      const s = clone(state)
      s.stake = text
      s.phase = 'STAKE_REVEAL'
      s.phaseEndsAt = now + DURATIONS.STAKE_REVEAL!
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
    case 'SUBMIT_ITEMS': {
      if (state.phase !== 'LIST_WRITE') return state
      const act = currentList(state)
      if (!act || action.player !== act.author) return state
      const text = action.text.trim().slice(0, LIST.maxLen)
      if (text.length === 0 || act.items.length >= LIST.items) return state
      const s = clone(state)
      const mine = currentList(s)!
      mine.items.push({
        id: `${mine.author}${mine.items.length}`,
        text,
        swapped: false,
        actualSlot: null,
        predictedSlot: null,
      })
      // The seventh field ends the phase early — nobody presses next.
      if (mine.items.length >= LIST.items) return beginSwap(s, now)
      return s
    }
    case 'SWAP_ITEM': {
      if (state.phase !== 'LIST_SWAP') return state
      const act = currentList(state)
      if (!act || action.player !== other(act.author)) return state // the ranker's veto only
      const s = clone(state)
      const mine = currentList(s)!
      const text = action.text.trim().slice(0, LIST.maxLen)
      if (action.index !== null && text.length > 0) {
        const item = mine.items[action.index]
        if (item) { item.text = text; item.swapped = true }
      }
      // Declined or spent, the veto is a one-shot and it closes the phase either way.
      return beginPlace(s, now)
    }
    case 'PLACE_ITEM': {
      if (state.phase !== 'LIST_PLACE') return state
      const act = currentList(state)
      if (!act) return state
      const byAuthor = action.player === act.author
      if (action.slot < 1 || action.slot > LIST.items) return state
      if (usedSlots(act, byAuthor).includes(action.slot)) return state // a used slot is dead
      const item = currentItem(act)!
      if (slotOf(item, byAuthor) !== null) return state // no changing your mind
      const s = clone(state)
      const mineItem = currentItem(currentList(s)!)!
      if (byAuthor) mineItem.predictedSlot = action.slot
      else mineItem.actualSlot = action.slot
      if (mineItem.actualSlot !== null && mineItem.predictedSlot !== null) return advancePlace(s, now)
      return s
    }
    case 'TIMEOUT': {
      switch (state.phase) {
        // 'list' skips Mind Meld and goes straight to Shortlist after the stake is set.
        case 'STAKE_REVEAL': return state.game === 'list' ? beginList(state, now, 'A') : beginMeld(state, now)
        case 'MELD_TYPE': return toMeldReveal(state, now)
        case 'MELD_REVEAL': return advanceReveal(state, now)
        // 'meld' is meld-only: the session ends here instead of moving on to Shortlist.
        case 'MELD_RESULT': return state.game === 'meld' ? finishSession(state) : beginList(state, now, 'A')
        case 'LIST_WRITE': return beginSwap(state, now)
        case 'LIST_SWAP': return beginPlace(state, now)
        case 'LIST_PLACE': return timeoutPlace(state, now)
        case 'LIST_REVEAL': return afterListReveal(state, now)
        default: return state
      }
    }
    default:
      return state
  }
}
