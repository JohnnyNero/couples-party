import type { Action, PlayerId, SessionState } from '../engine/state'
import { other } from '../engine/state'
import { currentAct, currentItem, lowestFreeSlot } from '../engine/list'

// A stand-in second player, so the loop can be played solo. It lives entirely outside
// the engine — it only ever produces the same actions a phone would, and the reducer
// cannot tell the difference. Everything here is pure: the caller supplies the rng and
// the clock, which keeps it testable and keeps Math.random out of the engine.

export type BotBrain = {
  nouns: string[]
}

export const EMPTY_BRAIN: BotBrain = { nouns: ['thing'] }

const pickFrom = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

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

    case 'LIST_PLACE': {
      const act = currentAct(s)
      if (!act) return null
      const item = currentItem(act)
      if (!item) return null
      const byAuthor = act.author === me
      const already = byAuthor ? item.predictedSlot !== null : item.actualSlot !== null
      if (already) return null
      // Not a considered guess — just any slot it hasn't already spent.
      return { type: 'PLACE_ITEM', player: me, slot: lowestFreeSlot(act, byAuthor) }
    }

    case 'LIKELY_ROUND': {
      const g = s.likely
      if (!g || g.rounds[g.current].picks[me] !== null) return null
      return { type: 'PICK_LIKELY', player: me, pick: rng() < 0.5 ? 'A' : 'B' }
    }

    case 'MM_ANSWER': {
      const g = s.mrmrs
      if (!g || g.rounds[g.current].answer[me] !== null) return null
      return {
        type: 'SUBMIT_MRMRS',
        player: me,
        answer: pickFrom(rng, brain.nouns),
        predict: pickFrom(rng, brain.nouns),
      }
    }

    case 'MM_JUDGE': {
      // Rules on the prediction about itself — a coin toss, since it has no opinions.
      const g = s.mrmrs
      if (!g || g.rounds[g.current].verdict[other(me)] !== null) return null
      return { type: 'JUDGE', player: me, correct: rng() < 0.5 }
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

    case 'DRAW_SKETCH': {
      const d = s.draw
      if (!d) return null
      const round = d.rounds[d.current]
      if (round.drawer !== me) return null
      // A single scribbled stroke — good enough for a testing seat, never a real guess.
      return {
        type: 'SUBMIT_DRAWING',
        player: me,
        answer: pickFrom(rng, brain.nouns),
        strokes: [[[0.2, 0.2], [0.8, 0.8]]],
      }
    }

    case 'DRAW_GUESS': {
      const d = s.draw
      if (!d) return null
      const round = d.rounds[d.current]
      if (other(round.drawer) !== me || round.guess !== null) return null
      return { type: 'SUBMIT_DRAW_GUESS', player: me, text: pickFrom(rng, brain.nouns) }
    }

    case 'CLASH_WRITE': {
      const g = s.clash
      if (!g) return null
      const round = g.rounds[g.current]
      if (round.answers[me] !== null) return null
      // Whatever it knows that starts with the letter — which isn't much.
      const fits = brain.nouns.filter((n) => n[0]?.toUpperCase() === round.letter)
      return { type: 'SUBMIT_CLASH', player: me, answers: round.categories.map((_, i) => fits[i] ?? '') }
    }

    case 'CIRCLE_DRAW': {
      const c = s.circle
      if (!c || c.rounds[c.current].drawn[me] !== null) return null
      // A wobbly hand-drawn circle, so it wins some and loses some.
      const wobble = 0.02 + rng() * 0.12
      const phase = rng() * Math.PI * 2
      const stroke: [number, number][] = Array.from({ length: 61 }, (_, i) => {
        const a = (i / 60) * 2 * Math.PI
        const r = 0.35 * (1 + wobble * Math.sin(a * 3 + phase))
        return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]
      })
      return { type: 'SUBMIT_CIRCLE', player: me, strokes: [stroke] }
    }

    case 'CLOCK_RUN':
    case 'DECIDER_RUN': {
      const g = s.phase === 'CLOCK_RUN' ? s.clock : s.decider
      if (!g) return null
      const round = g.rounds[g.current]
      if (round.stopped[me] !== null) return null
      // Within about 15% either side of the target.
      return { type: 'STOP_CLOCK', player: me, elapsedMs: round.targetMs * (0.85 + rng() * 0.3) }
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
    case 'LIST_PLACE': return spread(1200, 4000) // per item
    case 'LIKELY_ROUND': return spread(1500, 5000)
    case 'FINGER_ROUND': return spread(2000, 6000)
    case 'MM_ANSWER': return spread(6000, 15000)
    case 'MM_JUDGE': return spread(2000, 5000)
    case 'WAVE_CLUE': return spread(3000, 9000)
    case 'WAVE_GUESS': return spread(2000, 7000)
    case 'DRAW_SKETCH': return spread(5000, 15000)
    case 'DRAW_GUESS': return spread(2000, 7000)
    case 'CLASH_WRITE': return spread(15000, 40000)
    case 'CIRCLE_DRAW': return spread(2000, 6000)
    case 'CLOCK_RUN':
    case 'DECIDER_RUN': {
      // Taps at about the moment it claims to, so the dots fill at a believable time.
      const g = s.phase === 'CLOCK_RUN' ? s.clock : s.decider
      const target = g ? g.rounds[g.current].targetMs : 7000
      return target * (0.85 + rng() * 0.3)
    }
    default: return 1000
  }
}
