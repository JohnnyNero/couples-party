import type { DrawRound, FingerGame, ListAct, ListItem, PlayerId, SessionState, WaveRound } from './state'
import { other } from './state'

// An act outcome awards points on the spec's own numbers; the player ahead at the end
// of the session tops that session's leaderboard entry. The in-session tally is NEVER
// stored: it is derived from the act records here. If a number on the board is not one
// of these, something has gone wrong.

export type Standing = Record<PlayerId, number>

export type Award = { player: PlayerId; points: number } | null

// Act III scores item by item, to the author — they're the one guessing how they're
// read. Three for landing on the ranker's exact slot, one for being a single place out,
// nothing beyond that.
export function listItemPoints(item: ListItem): number {
  if (item.actualSlot === null || item.predictedSlot === null) return 0
  const gap = Math.abs(item.actualSlot - item.predictedSlot)
  if (gap === 0) return 3
  if (gap === 1) return 1
  return 0
}

// Only the items the reveal has actually walked past count, so the running total on the
// reveal screen and the leaderboard in the header are the same number — the score climbs
// as the items turn over instead of landing all at once.
export function listAward(act: ListAct): Award {
  if (act.displacement === null) return null // still being placed
  const shown = act.items.slice(0, act.revealIndex + 1)
  const points = shown.reduce((n, item) => n + listItemPoints(item), 0)
  return points === 0 ? null : { player: act.author, points }
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

// Quick Draw: the guesser reads the drawing correctly or they don't — no partial
// credit, no consolation for a miss, it's a fast, low-stakes round.
export function drawAward(round: DrawRound): Award {
  if (round.correct === null) return null
  return round.correct ? { player: other(round.drawer), points: 2 } : null
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
  for (const round of s.draw?.rounds ?? []) {
    const dAward = drawAward(round)
    if (dAward) tally[dAward.player] += dAward.points
  }
  return tally
}

// Who is ahead this session, or null if level.
export function leader(s: SessionState): PlayerId | null {
  const t = standing(s)
  if (t.A === t.B) return null
  return t.A > t.B ? 'A' : 'B'
}
