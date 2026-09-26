import type {
  BluffGame, BluffRound, ClashRound, MeldRound, DrawRound, FingerGame, FingerRound, GameKey, LikelyGame, LikelyRound, ListAct, ListItem, MrMrsGame,
  MrMrsRound, PlayerId, SessionState, WaveRound,
} from './state'
import { other } from './state'
import { GAME_LABELS, roster, roundsFor, type RosterOf } from './roster'
import { FILLER } from './phases'
import { clockRoundWinner, fillerOver, fillerWinner, type Filler } from './fillers'
import { clashCellPoints, clashVerdict } from './clash'
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
//     maximum            42           36       40      36
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
  calledRight: 1, // Called It: each right call on your partner (scaled like everything)
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

// ---------------------------------------------------------------- team raw points

// Every correct read of each other is a team point.
export const mrmrsTeamRaw = (round: MrMrsRound) => (round.verdict.A ? 1 : 0) + (round.verdict.B ? 1 : 0)
// Every truth spotted.
export const bluffTeamRaw = (round: BluffRound) => (round.pick.A === 0 ? 1 : 0) + (round.pick.B === 0 ? 1 : 0)
// A clue and a read that land close: 2 within 5, 1 within 15.
export function waveTeamRaw(round: WaveRound): number {
  const d = round.distance
  if (d === null) return 0
  return d <= 5 ? 2 : d <= 15 ? 1 : 0
}
// Mind Meld: 3 for meeting on the first try, 2 on the second, 1 on the third.
export const meldTeamRaw = (round: MeldRound) => (round.matched === null ? 0 : MELD_POINTS[round.matched] ?? 0)
export const MELD_POINTS = [3, 2, 1]

// The same answer from you both — a mind meld, even though it scores neither of you.
export function clashTeamRaw(round: ClashRound, upTo = round.categories.length - 1): number {
  let n = 0
  for (let i = 0; i <= upTo; i++) if (clashVerdict(round, 'A', i) === 'same') n += 1
  return n
}

// ---------------------------------------------------------------- Called It

// A call on your partner that was right. Nothing counts until you've both answered —
// which is also when it's revealed.
export function calledRight(round: FingerRound, p: PlayerId): boolean {
  const theirs = round.answer[other(p)]
  return round.answer.A !== null && round.answer.B !== null && round.predict[p] !== null && round.predict[p] === theirs
}

export function fingerRoundPoints(round: FingerRound, p: PlayerId): number {
  return calledRight(round, p) ? SCORING.calledRight : 0
}

export function fingerPoints(f: FingerGame | null): Standing {
  const tally: Standing = { A: 0, B: 0 }
  for (const round of f?.rounds ?? []) {
    tally.A += fingerRoundPoints(round, 'A')
    tally.B += fingerRoundPoints(round, 'B')
  }
  return tally
}

// Every right call is a team point too.
export const fingerTeamRaw = (round: FingerRound) => (calledRight(round, 'A') ? 1 : 0) + (calledRight(round, 'B') ? 1 : 0)

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

// ---------------------------------------------------------------- Scaling

// Every game counts the same towards the night, however many rounds it runs: on
// average, a game hands out PER_GAME.you points between the two of you (so about half
// each) and PER_GAME.us team points — the points you score together, for knowing each
// other. Each game keeps its own natural scoring in "raw" points (above); what the board
// shows is that, scaled to the budget for the number of rounds this session plays.
//
// The scale comes from AVERAGE: what an average couple — right about half the time,
// close some of the rest — scores per round, in raw points, per game. Change a game's
// raw points and its average has to move with it, or that game quietly starts to count
// for more (or less) than the others.
export const PER_GAME = { you: 40, us: 20 } as const

type Scaled = Exclude<GameKey, 'lights' | 'circle' | 'clock'>
export const AVERAGE: Record<Scaled, { you: number; us: number }> = {
  // Per act: 7 items, 3 for an exact slot (about a quarter), 1 for one out (about a third).
  list: { you: 7.7, us: 1.75 },
  // Per statement: you both score 7 when you agree (a bit over half the time).
  likely: { you: 7.7, us: 0.55 },
  // Two predictions a round, 8 each, right a bit under half the time; each right one is
  // a team point too.
  mrmrs: { you: 7.2, us: 0.9 },
  // Per clue: 6/4/2 to the clue-giver by how close, 2 to the guesser for a wide miss.
  wave: { you: 2, us: 0.7 },
  // Per drawing: 6 to the guesser, half the time.
  draw: { you: 3, us: 0.5 },
  // Per round: six categories each, 2 for a unique answer (about 60% of them); matching
  // answers are the team's.
  clash: { you: 14.4, us: 0.8 },
  // Per round: 10 to the winner; the team scores every word you chained together.
  chain: { you: 9.5, us: 12 },
  // Per round: two picks, 7 to someone every time; each truth spotted is the team's.
  bluff: { you: 14, us: 0.8 },
  // Called It, per statement: two calls, each right about two times in three.
  finger: { you: 1.3, us: 1.3 },
  // Mind Meld, per prompt: team only — 3 for meeting first time, 2 second, 1 third.
  meld: { you: 0, us: 1.45 },
  // Describe It, per turn: every word got — to the describer, and to the team.
  describe: { you: 6, us: 6 },
}

export type Scale = { you: number; us: number }

export function scaleFor(s: RosterOf, key: GameKey): Scale {
  if (!(key in AVERAGE)) return { you: 1, us: 0 } // fillers: their flat prize, no team points
  const avg = AVERAGE[key as Scaled]
  const rounds = Math.max(1, roundsFor(s, key))
  return {
    you: avg.you > 0 ? PER_GAME.you / (avg.you * rounds) : 0,
    us: avg.us > 0 ? PER_GAME.us / (avg.us * rounds) : 0,
  }
}

// A raw award as the board shows it: scaled for this session, in whole points.
export const shown = (s: RosterOf, key: GameKey, raw: number, kind: keyof Scale = 'you') =>
  Math.round(raw * scaleFor(s, key)[kind])

// ---------------------------------------------------------------- The board

export type GameScore = {
  key: Exclude<GameKey, 'lights'> | 'decider'
  label: string
  points: Standing // yours, each — who wins the night
  team: number // yours together
  played: boolean
}

const zero = (): Standing => ({ A: 0, B: 0 })

const sumAwards = (awards: Award[]): Standing => {
  const t = zero()
  for (const a of awards) if (a) t[a.player] += a.points
  return t
}

// Every award a game has made so far, in raw points — to one of you, and to the team.
// Each one is scaled (and rounded) on its own, so the totals are always the sum of the
// "+n"s the reveal screens showed.
type Raw = { you: Award[]; us: number[] }

function rawFor(s: SessionState, key: Exclude<GameKey, 'lights' | 'circle' | 'clock'>): Raw {
  const you: Award[] = []
  const us: number[] = []
  switch (key) {
    case 'list':
      for (const act of s.listActs) {
        if (act.displacement === null) continue
        const shownItems = act.items.slice(0, act.revealIndex + 1)
        for (const item of shownItems) you.push({ player: act.author, points: listItemPoints(item) })
        us.push(shownItems.filter((i) => listItemPoints(i) === SCORING.listExact).length)
      }
      break
    case 'likely':
      for (const round of s.likely?.rounds ?? []) {
        const pts = likelyRoundPoints(round)
        if (!pts) continue
        you.push({ player: 'A', points: pts }, { player: 'B', points: pts })
        us.push(1)
      }
      break
    case 'mrmrs':
      for (const round of s.mrmrs?.rounds ?? []) {
        for (const p of ['A', 'B'] as PlayerId[]) you.push({ player: p, points: mrmrsRoundPoints(round, p) })
        us.push(mrmrsTeamRaw(round))
      }
      break
    case 'bluff':
      for (const round of s.bluff?.rounds ?? []) {
        for (const owner of ['A', 'B'] as PlayerId[]) you.push(bluffAward(round, owner))
        us.push(bluffTeamRaw(round))
      }
      break
    case 'wave':
      for (const round of s.wave?.rounds ?? []) {
        you.push(waveAward(round))
        us.push(waveTeamRaw(round))
      }
      break
    case 'draw':
      for (const round of s.draw?.rounds ?? []) {
        you.push(drawAward(round))
        us.push(round.correct ? 1 : 0)
      }
      break
    case 'clash':
      s.clash?.rounds.forEach((round, r) => {
        const live = r === s.clash!.current
        if (r > s.clash!.current || (live && s.phase === 'CLASH_WRITE')) return
        const upTo = live ? round.revealIndex : round.categories.length - 1
        for (let i = 0; i <= upTo; i++) {
          for (const p of ['A', 'B'] as PlayerId[]) you.push({ player: p, points: clashCellPoints(round, p, i) })
        }
        us.push(clashTeamRaw(round, upTo))
      })
      break
    case 'finger':
      for (const round of s.finger?.rounds ?? []) {
        for (const p of ['A', 'B'] as PlayerId[]) you.push({ player: p, points: fingerRoundPoints(round, p) })
        us.push(fingerTeamRaw(round))
      }
      break
    case 'describe':
      for (const turn of s.describe?.turns ?? []) {
        if (turn.got.length === 0) continue
        you.push({ player: turn.describer, points: turn.got.length })
        us.push(turn.got.length)
      }
      break
    case 'meld':
      for (const round of s.meld?.rounds ?? []) us.push(meldTeamRaw(round))
      break
    case 'chain':
      for (const round of s.chain?.rounds ?? []) {
        const w = chainRoundWinner(round)
        if (w) you.push({ player: w, points: CHAIN.winPoints })
        us.push(round.chain.filter((l) => l.by !== null).length)
      }
      break
  }
  return { you, us }
}

function scoreFor(s: SessionState, key: Exclude<GameKey, 'lights'>): { points: Standing; team: number } {
  if (key === 'circle') return { points: fillerPoints(s.circle && { kind: 'circle', game: s.circle }), team: 0 }
  if (key === 'clock') return { points: fillerPoints(s.clock && { kind: 'clock', game: s.clock }), team: 0 }
  const raw = rawFor(s, key)
  const points = zero()
  for (const a of raw.you) if (a) points[a.player] += shown(s, key, a.points)
  const team = raw.us.reduce((n, u) => n + shown(s, key, u, 'us'), 0)
  return { points, team }
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
    .map((key) => ({ key, label: GAME_LABELS[key], ...scoreFor(s, key), played: playedYet(s, key) }))
  // Only there once a level night has needed it.
  if (s.decider) rows.push({ key: 'decider', label: 'Tiebreaker', points: deciderPoints(s), team: 0, played: true })
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

// Your points together, across the whole session.
export function teamScore(s: SessionState): number {
  return gameScores(s).reduce((n, g) => n + g.team, 0)
}

// Who is ahead this session, or null if level.
export function leader(s: SessionState): PlayerId | null {
  const t = standing(s)
  if (t.A === t.B) return null
  return t.A > t.B ? 'A' : 'B'
}
