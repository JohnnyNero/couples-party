import type { FingerGame, ListAct, PlayerId, SessionState, WaveRound } from './state'
import { other } from './state'

// An act outcome awards points on the spec's own numbers; the player ahead at the end
// of the session tops that session's leaderboard entry. The in-session tally is NEVER
// stored: it is derived from the act records here. If a number on the board is not one
// of these, something has gone wrong.

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

// Put a Finger Down: whoever has more fingers left after five rounds takes it — level
// hands is just a tie, no drama needed for a bedtime game.
export function fingerAward(f: FingerGame | null): Award {
  if (!f) return null
  const { A, B } = f.fingersLeft
  if (A === B) return null
  return A > B ? { player: 'A', points: 2 } : { player: 'B', points: 2 }
}

// Wavelength: a good clue is the psychic's to be rewarded for — the closer the guess
// they steered, the more points; a very wide miss gives the guesser something back,
// the same shape as Shortlist's own worst-case consolation.
export function waveAward(round: WaveRound): Award {
  const d = round.distance
  if (d === null) return null
  if (d === 0) return { player: round.psychic, points: 3 }
  if (d <= 5) return { player: round.psychic, points: 2 }
  if (d <= 15) return { player: round.psychic, points: 1 }
  if (d <= 30) return null
  return { player: other(round.psychic), points: 1 }
}

export function standing(s: SessionState): Standing {
  const tally: Standing = { A: 0, B: 0 }
  for (const act of s.listActs) {
    const award = listAward(act)
    if (award) tally[award.player] += award.points
  }
  const fAward = fingerAward(s.finger)
  if (fAward) tally[fAward.player] += fAward.points
  for (const round of s.wave?.rounds ?? []) {
    const wAward = waveAward(round)
    if (wAward) tally[wAward.player] += wAward.points
  }
  return tally
}

// Who is ahead this session, or null if level.
export function leader(s: SessionState): PlayerId | null {
  const t = standing(s)
  if (t.A === t.B) return null
  return t.A > t.B ? 'A' : 'B'
}
