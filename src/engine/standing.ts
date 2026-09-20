import type { ListAct, PlayerId, SessionState } from './state'
import { other } from './state'

// Ruling M3-1: with the pot cut down to one agreed stake, an act outcome awards points
// on the spec's own numbers, and the player ahead at the end of the session wins — the
// other one does the forfeit. The tally is NEVER stored: it is derived from the act
// records here, the same way the spec derived standing from the `forfeits` array. If a
// number on the board is not one of these, something has gone wrong.

export type Standing = Record<PlayerId, number>

export type Award = { player: PlayerId; points: number } | null

// Spec, Act III scoring: 0 → author 3, 1–4 → author 1, 5–12 → nothing,
// 13+ → ranker 1 (being read that badly deserves something).
export function listAward(act: ListAct): Award {
  const d = act.displacement
  if (d === null) return null
  if (d === 0) return { player: act.author, points: 3 }
  if (d <= 4) return { player: act.author, points: 1 }
  if (d <= 12) return null
  return { player: other(act.author), points: 1 }
}

export function standing(s: SessionState): Standing {
  const tally: Standing = { A: 0, B: 0 }
  for (const act of s.listActs) {
    const award = listAward(act)
    if (award) tally[award.player] += award.points
  }
  return tally
}

// Who is ahead, or null if level. At the end of the session the other player owes the
// stake; level means SUDDEN_DEATH (M5).
export function leader(s: SessionState): PlayerId | null {
  const t = standing(s)
  if (t.A === t.B) return null
  return t.A > t.B ? 'A' : 'B'
}
