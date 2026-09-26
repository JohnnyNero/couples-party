import type {
  BluffGame, BluffRound, DrawRound, FingerGame, FingerRound, GameKey, LikelyGame, LikelyRound, ListAct, ListItem, MrMrsGame,
  MrMrsRound, PlayerId, SessionState, WaveRound,
} from './state'
import { other } from './state'
import { GAME_LABELS, roster } from './roster'
import { FILLER } from './phases'
import { clockRoundWinner, fillerOver, fillerWinner, type Filler } from './fillers'
import { clashPoints } from './clash'
import { chainRoundWinner } from './chain'
import { CHAIN } from './phases'

// The in-session tally is NEVER stored: it is derived from the act records here. If a
// number on the board is not one of these, something has gone wrong.
//
// Every game is tuned to top out near 40 over a full session, so any one of them can
// still turn the night around. Shortlist sets the scale — it pays 3 a hit across 14 items
// over two acts — and the others are scaled UP to meet it rather than Shortlist being cut
// down. Simulated over 60k sessions, a middling pair takes 15–20 out of the original four:
//
//     play        Shortlist   Wavelength   Finger   Draw
//     ok               15.5         17.4     20.0    18.0
//     good             26.0         23.0     22.0    28.8
//     maximum            42           42       40      36
//
// Who's More Likely (6 × 7 = 42) and Mr & Mrs (5 × 8 = 40) were set to the same ceiling.
// Who's More Likely pays you both when you agree, so it lifts the total without moving
// the lead — it's the warm-up, not a decider. A test holds every maximum within 25%.
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
  likelyAgree: 7, // to each of you, when you named the same person
  mrmrsRight: 8, // to whoever predicted right, as ruled by the person it was about
  bluffSpotted: 7, // to the guesser, for picking the truth
  bluffFooled: 7, // to the bluffer, when a lie (or the clock) got them
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

// ---------------------------------------------------------------- Who's More Likely

// Agreeing is the point — both of you score, or neither does. A round only pays once
// both names are in, which is also the moment it's revealed, so nothing leaks early.
export function likelyRoundPoints(round: LikelyRound): number {
  const { A, B } = round.picks
  return A !== null && A === B ? SCORING.likelyAgree : 0
}

export function likelyPoints(g: LikelyGame | null): Standing {
  const t: Standing = { A: 0, B: 0 }
  for (const round of g?.rounds ?? []) {
    const pts = likelyRoundPoints(round)
    t.A += pts
    t.B += pts
  }
  return t
}

// ---------------------------------------------------------------- Mr & Mrs

export function mrmrsRoundPoints(round: MrMrsRound, p: PlayerId): number {
  return round.verdict[p] ? SCORING.mrmrsRight : 0
}

export function mrmrsPoints(g: MrMrsGame | null): Standing {
  const t: Standing = { A: 0, B: 0 }
  for (const round of g?.rounds ?? []) {
    t.A += mrmrsRoundPoints(round, 'A')
    t.B += mrmrsRoundPoints(round, 'B')
  }
  return t
}

// ---------------------------------------------------------------- Two Lies & a Truth

// Every pick pays someone: the guesser for finding the truth, the bluffer when they
// didn't. Three rounds is six picks, three each way — so 42 at most, like the rest.
export function bluffAward(round: BluffRound, owner: PlayerId): Award {
  const pick = round.pick[owner]
  if (pick === null) return null
  return pick === 0
    ? { player: other(owner), points: SCORING.bluffSpotted }
    : { player: owner, points: SCORING.bluffFooled }
}

export function bluffPoints(g: BluffGame | null): Standing {
  return sumAwards((g?.rounds ?? []).flatMap((r) => [bluffAward(r, 'A'), bluffAward(r, 'B')]))
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

// ---------------------------------------------------------------- Draw Your Answer

// The guesser reads the drawing or they don't — no partial credit. A near miss the
// drawer waves through counts in full.
export function drawAward(round: DrawRound): Award {
  if (round.correct === null) return null
  return round.correct ? { player: other(round.drawer), points: SCORING.drawCorrect } : null
}

// ---------------------------------------------------------------- The board

// ---------------------------------------------------------------- the fillers

// A flat prize to whoever wins the filler, however many rounds it took — and only once
// it's over, so leading a best of 5 after one round isn't worth the whole prize.
export function fillerPoints(f: Filler | null): Standing {
  const t: Standing = { A: 0, B: 0 }
  if (!f || !fillerOver(f)) return t
  const w = fillerWinner(f)
  if (w) t[w] = FILLER.winPoints
  return t
}

// The tiebreaker pays the one round that broke the tie.
export function deciderPoints(s: SessionState): Standing {
  const t: Standing = { A: 0, B: 0 }
  for (const round of s.decider?.rounds ?? []) {
    const w = clockRoundWinner(round)
    if (w) {
      t[w] = FILLER.deciderPoints
      break
    }
  }
  return t
}

// ---------------------------------------------------------------- The board

export type GameScore = {
  key: Exclude<GameKey, 'lights'> | 'decider'
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

function pointsFor(s: SessionState, key: Exclude<GameKey, 'lights'>): Standing {
  switch (key) {
    case 'list': return sumAwards(s.listActs.map(listAward))
    case 'likely': return likelyPoints(s.likely)
    case 'finger': return fingerPoints(s.finger)
    case 'mrmrs': return mrmrsPoints(s.mrmrs)
    case 'bluff': return bluffPoints(s.bluff)
    case 'wave': return sumAwards((s.wave?.rounds ?? []).map(waveAward))
    case 'draw': return sumAwards((s.draw?.rounds ?? []).map(drawAward))
    case 'clash': return clashPoints(s.clash, s.phase !== 'CLASH_WRITE')
    case 'chain': {
      const t = zero()
      for (const round of s.chain?.rounds ?? []) {
        const w = chainRoundWinner(round)
        if (w) t[w] += CHAIN.winPoints
      }
      return t
    }
    case 'circle': return fillerPoints(s.circle && { kind: 'circle', game: s.circle })
    case 'clock': return fillerPoints(s.clock && { kind: 'clock', game: s.clock })
  }
}

function playedYet(s: SessionState, key: Exclude<GameKey, 'lights'>): boolean {
  return key === 'list' ? s.listActs.length > 0 : s[key] !== null
}

// Every scored game in THIS session's roster, in playing order — the scoreboard between
// games is this list, and the session total is just its sum. A Tonight board shows
// Tonight's games; a single-game session shows one row. `played` is false for a game
// the night hasn't reached yet.
export function gameScores(s: SessionState): GameScore[] {
  const rows: GameScore[] = roster(s.game, s.night)
    .map((e) => e.key)
    .filter((key): key is Exclude<GameKey, 'lights'> => key !== 'lights')
    .map((key) => ({ key, label: GAME_LABELS[key], points: pointsFor(s, key), played: playedYet(s, key) }))
  // Only there once a level night has needed it.
  if (s.decider) rows.push({ key: 'decider', label: 'Tiebreaker', points: deciderPoints(s), played: true })
  return rows
}

// A night of several games that finishes level goes to a tiebreaker before Lights Out —
// once. A single game played on its own can end level; that's just a draw.
export function needsDecider(s: SessionState): boolean {
  if (s.game !== 'full' && s.game !== 'tonight') return false
  if (s.decider !== null) return false
  const t = standing(s)
  return t.A === t.B
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
