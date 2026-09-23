import type {
  DrawRound, FingerGame, FingerRound, Game, ListAct, ListItem, PlayerId, SessionState, WaveRound,
} from './state'
import { other } from './state'

// The in-session tally is NEVER stored: it is derived from the act records here. If a
// number on the board is not one of these, something has gone wrong.
//
// Every game is tuned to top out near 40, so any one of them can still turn the night
// around. Shortlist sets the scale — it pays 3 a hit across 14 items over two acts —
// and the other three are scaled UP to meet it rather than Shortlist being cut down.
// Simulated over 60k sessions, a middling pair takes 15–20 out of each game:
//
//     play        Shortlist   Wavelength   Finger   Quick Draw
//     ok               15.5         17.4     20.0         18.0
//     good             26.0         23.0     22.0         28.8
//     maximum            42           42       40           36
//
// Change one of these and the others have to move with it, or the game it belongs to
// quietly starts deciding the session on its own.
export const SCORING = {
  listExact: 3, // the ranker's exact slot
  listNear: 1, // one place out
  waveBullseye: 6,
  waveClose: 4, // within 5
  waveNear: 2, // within 15
  waveConsolation: 2, // a miss wide enough that the guesser deserves something
  fingerKept: 8, // per statement you don't put a finger down on
  drawCorrect: 6,
} as const

export type Standing = Record<PlayerId, number>

export type Award = { player: PlayerId; points: number } | null

// ---------------------------------------------------------------- Shortlist

// Act III scores item by item, to the author — they're the one guessing how they're
// read. Three for the ranker's exact slot, one for being a single place out.
export function listItemPoints(item: ListItem): number {
  if (item.actualSlot === null || item.predictedSlot === null) return 0
  const gap = Math.abs(item.actualSlot - item.predictedSlot)
  if (gap === 0) return SCORING.listExact
  if (gap === 1) return SCORING.listNear
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

// ---------------------------------------------------------------- Put a Finger Down

// Scored per statement rather than once at the end: both players can come out of the
// same round with points, so this is a tally, not an Award.
export function fingerRoundPoints(round: FingerRound, p: PlayerId): number {
  // A round pays nothing until both have answered — which is also when it's revealed.
  if (round.applies.A === null || round.applies.B === null) return 0
  return round.applies[p] ? 0 : SCORING.fingerKept
}

export function fingerPoints(f: FingerGame | null): Standing {
  const tally: Standing = { A: 0, B: 0 }
  if (!f) return tally
  for (const round of f.rounds) {
    tally.A += fingerRoundPoints(round, 'A')
    tally.B += fingerRoundPoints(round, 'B')
  }
  return tally
}

// ---------------------------------------------------------------- Wavelength

// A good clue is the clue-giver's to be rewarded for — the closer the guess they steered,
// the more points; a very wide miss gives the guesser something back instead.
export function waveAward(round: WaveRound): Award {
  const d = round.distance
  if (d === null) return null
  if (d === 0) return { player: round.psychic, points: SCORING.waveBullseye }
  if (d <= 5) return { player: round.psychic, points: SCORING.waveClose }
  if (d <= 15) return { player: round.psychic, points: SCORING.waveNear }
  if (d <= 30) return null
  return { player: other(round.psychic), points: SCORING.waveConsolation }
}

// ---------------------------------------------------------------- Quick Draw

// The guesser reads the drawing or they don't — no partial credit, it's a fast round.
export function drawAward(round: DrawRound): Award {
  if (round.correct === null) return null
  return round.correct ? { player: other(round.drawer), points: SCORING.drawCorrect } : null
}

// ---------------------------------------------------------------- The board

export type GameScore = {
  key: Exclude<Game, 'full'>
  label: string
  points: Standing
  played: boolean
}

const zero = (): Standing => ({ A: 0, B: 0 })

const sumAwards = (awards: Award[]): Standing => {
  const t = zero()
  for (const a of awards) if (a) t[a.player] += a.points
  return t
}

// Every game's contribution, in playing order — the scoreboard between games is this
// list, and the session total is just its sum. `played` is false for a game the session
// hasn't reached (or, in a single-game session, will never reach).
export function gameScores(s: SessionState): GameScore[] {
  return [
    {
      key: 'list',
      label: 'Shortlist',
      points: sumAwards(s.listActs.map(listAward)),
      played: s.listActs.length > 0,
    },
    {
      key: 'finger',
      label: 'Put a Finger Down',
      points: fingerPoints(s.finger),
      played: s.finger !== null,
    },
    {
      key: 'wave',
      label: 'Wavelength',
      points: sumAwards((s.wave?.rounds ?? []).map(waveAward)),
      played: s.wave !== null,
    },
    {
      key: 'draw',
      label: 'Quick Draw',
      points: sumAwards((s.draw?.rounds ?? []).map(drawAward)),
      played: s.draw !== null,
    },
  ]
}

export function standing(s: SessionState): Standing {
  const tally = zero()
  for (const game of gameScores(s)) {
    tally.A += game.points.A
    tally.B += game.points.B
  }
  return tally
}

// Who is ahead this session, or null if level.
export function leader(s: SessionState): PlayerId | null {
  const t = standing(s)
  if (t.A === t.B) return null
  return t.A > t.B ? 'A' : 'B'
}
