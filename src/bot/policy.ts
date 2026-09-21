import type { Action, PlayerId, SessionState } from '../engine/state'
import { other } from '../engine/state'
import { normalize } from '../engine/match'
import { currentAct } from '../engine/list'
import { LIST } from '../engine/phases'
import { isAlreadySaid } from '../views/meld'

// A stand-in second player, so the loop can be played solo. It lives entirely outside
// the engine — it only ever produces the same actions a phone would, and the reducer
// cannot tell the difference. Everything here is pure: the caller supplies the rng and
// the clock, which keeps it testable and keeps Math.random out of the engine.

export type BotBrain = {
  words: Record<string, string[]>
  nouns: string[]
  items: string[]
}

export const EMPTY_BRAIN: BotBrain = { words: {}, nouns: ['thing'], items: ['a thing'] }

const pickFrom = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

// "Meet in the middle", crudely: prefer a word both sides point at, then a neighbour of
// either, then any noun. Never repeat a word the session has already used — that is the
// cat/dog death spiral the phone guards against, and the bot honours the same rule.
export function meldWord(
  brain: BotBrain,
  pair: [string, string],
  isTaken: (word: string) => boolean,
  rng: () => number,
): string {
  const [a, b] = pair.map((w) => normalize(w))
  // Look the word up as written first: `normalize` folds a trailing "s", and half the
  // seed list ("handcuffs") would otherwise never find its own entry.
  const near = (w: string, raw: string) =>
    brain.words[raw.trim().toLowerCase()] ?? brain.words[w] ?? []
  const nearA = near(a, pair[0])
  const nearB = near(b, pair[1])
  const both = nearA.filter((w) => nearB.includes(w))
  const either = [...nearA, ...nearB]

  for (const pool of [both, either, brain.nouns]) {
    const free = pool.filter((w) => !isTaken(w) && normalize(w) !== a && normalize(w) !== b)
    if (free.length > 0) return pickFrom(rng, free)
  }
  // Everything it knows is spent: say something rather than time out.
  return `${pickFrom(rng, brain.nouns)} ${Math.floor(rng() * 100)}`
}

// One decision per call, or null when the bot has nothing to do in this phase — it has
// already acted, or the phase belongs to the other player.
export function nextBotAction(
  s: SessionState,
  me: PlayerId,
  brain: BotBrain,
  rng: () => number,
): Action | null {
  switch (s.phase) {
    case 'JOIN':
      return s.players[me].connected ? null : { type: 'JOIN', player: me, name: 'BOT' }

    case 'MELD_TYPE': {
      const meld = s.meld
      if (!meld) return null
      const round = meld.rounds[meld.rounds.length - 1]
      if (round.words[me] !== null) return null
      const pair: [string, string] =
        round.index === 1
          ? meld.seedPair
          : [meld.rounds[round.index - 2].words.A ?? '—', meld.rounds[round.index - 2].words.B ?? '—']
      const word = meldWord(brain, pair, (w) => isAlreadySaid(meld, round, w), rng)
      return { type: 'SUBMIT_WORD', player: me, word }
    }

    case 'LIST_WRITE': {
      const act = currentAct(s)
      if (!act || act.author !== me || act.items.length >= LIST.items) return null
      const picked = new Set(act.items.map((i) => i.poolIndex))
      const free = act.pool.map((_, i) => i).filter((i) => !picked.has(i))
      if (free.length === 0) return null
      return { type: 'SUBMIT_ITEMS', player: me, poolIndex: pickFrom(rng, free) }
    }

    case 'LIST_SWAP': {
      const act = currentAct(s)
      if (!act || other(act.author) !== me) return null
      // Mostly leaves the list alone — the veto is a guardrail, not a move.
      if (rng() > 0.25) return { type: 'SWAP_ITEM', player: me, index: null, text: '' }
      const written = new Set(act.items.map((i) => i.text))
      const free = brain.items.filter((t) => !written.has(t))
      if (free.length === 0) return { type: 'SWAP_ITEM', player: me, index: null, text: '' }
      return {
        type: 'SWAP_ITEM',
        player: me,
        index: Math.floor(rng() * act.items.length),
        text: pickFrom(rng, free),
      }
    }

    case 'LIST_PLACE': {
      const act = currentAct(s)
      if (!act) return null
      const byAuthor = act.author === me
      const already = act.items.every((i) => (byAuthor ? i.predictedSlot : i.actualSlot) !== null)
      if (already) return null
      // Shuffle its own copy of the order — good enough for a testing seat.
      const order = act.items.map((i) => i.id)
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
      }
      return { type: 'SUBMIT_ORDER', player: me, order }
    }

    case 'FINGER_ROUND': {
      const f = s.finger
      if (!f) return null
      const round = f.rounds[f.current]
      if (round.applies[me] !== null) return null
      // A little more often true than false — a hand that never goes down is no fun.
      return { type: 'SUBMIT_FINGER', player: me, applies: rng() < 0.55 }
    }

    case 'WAVE_CLUE': {
      const w = s.wave
      if (!w) return null
      const round = w.rounds[w.current]
      if (round.psychic !== me || round.clue !== null) return null
      return { type: 'SUBMIT_CLUE', player: me, text: pickFrom(rng, brain.nouns) }
    }

    case 'WAVE_GUESS': {
      const w = s.wave
      if (!w) return null
      const round = w.rounds[w.current]
      if (other(round.psychic) !== me || round.guess !== null) return null
      return { type: 'SUBMIT_GUESS', player: me, value: Math.floor(rng() * 101) }
    }

    default:
      return null
  }
}

// How long the bot sits on its hands. Kept well inside each phase's clock so it acts
// like a player rather than a race condition, and long enough that the submission dots
// fill at something like human pace.
export function botDelay(s: SessionState, rng: () => number): number {
  const spread = (min: number, max: number) => min + rng() * (max - min)
  switch (s.phase) {
    case 'JOIN': return 400
    case 'MELD_TYPE': return spread(4000, 11000)
    case 'LIST_WRITE': return spread(1500, 4000) // per item
    case 'LIST_SWAP': return spread(3000, 8000)
    case 'LIST_PLACE': return spread(2500, 8000)
    case 'FINGER_ROUND': return spread(2000, 6000)
    case 'WAVE_CLUE': return spread(3000, 9000)
    case 'WAVE_GUESS': return spread(2000, 7000)
    default: return 1000
  }
}
