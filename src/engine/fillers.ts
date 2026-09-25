import type { CircleGame, CircleRound, ClockGame, ClockRound, DrawStroke, PlayerId } from './state'
import { CIRCLE, CLOCK } from './phases'

// Scoring for the two fillers, pure so both phones, the host and the tests all agree.

// ---------------------------------------------------------------- Perfect Circle

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

function pathLength(stroke: DrawStroke): number {
  let n = 0
  for (let i = 1; i < stroke.length; i++) n += dist(stroke[i - 1], stroke[i])
  return n
}

// The stroke that counts, thinned to at most CIRCLE.maxPoints and rounded, so a long
// scribble doesn't bloat what's broadcast to both phones.
export function keepCircle(strokes: DrawStroke[]): DrawStroke {
  let best: DrawStroke = []
  for (const s of strokes) if (pathLength(s) > pathLength(best)) best = s
  const step = Math.ceil(best.length / CIRCLE.maxPoints)
  const thin = step > 1 ? best.filter((_, i) => i % step === 0 || i === best.length - 1) : best
  const r = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000
  return thin.map(([x, y]) => [r(x), r(y)])
}

// The fitted circle: the path's centre and average radius, each weighted by segment
// length so a slow bit of drawing (lots of points close together) doesn't pull it.
export function fitCircle(stroke: DrawStroke): { cx: number; cy: number; r: number } | null {
  let len = 0
  let cx = 0
  let cy = 0
  for (let i = 1; i < stroke.length; i++) {
    const seg = dist(stroke[i - 1], stroke[i])
    cx += ((stroke[i - 1][0] + stroke[i][0]) / 2) * seg
    cy += ((stroke[i - 1][1] + stroke[i][1]) / 2) * seg
    len += seg
  }
  if (len === 0) return null
  cx /= len
  cy /= len
  let r = 0
  for (let i = 1; i < stroke.length; i++) {
    const seg = dist(stroke[i - 1], stroke[i])
    r += dist([(stroke[i - 1][0] + stroke[i][0]) / 2, (stroke[i - 1][1] + stroke[i][1]) / 2], [cx, cy]) * seg
  }
  return { cx, cy, r: r / len }
}

// 0..100 to one decimal. Mostly wobble — how far the line strays from its own average
// radius — with a penalty for a gap between start and end. It has to go most of the way
// round and be a decent size, or it's no circle at all.
export function circleScore(stroke: DrawStroke | null): number {
  if (!stroke || stroke.length < 8) return 0
  const fit = fitCircle(stroke)
  if (!fit || fit.r < CIRCLE.minRadius) return 0
  const { cx, cy, r } = fit

  let sweep = 0
  let len = 0
  let variance = 0
  for (let i = 1; i < stroke.length; i++) {
    const a0 = Math.atan2(stroke[i - 1][1] - cy, stroke[i - 1][0] - cx)
    const a1 = Math.atan2(stroke[i][1] - cy, stroke[i][0] - cx)
    let d = a1 - a0
    if (d > Math.PI) d -= 2 * Math.PI
    if (d < -Math.PI) d += 2 * Math.PI
    sweep += d
    const seg = dist(stroke[i - 1], stroke[i])
    const mid: [number, number] = [(stroke[i - 1][0] + stroke[i][0]) / 2, (stroke[i - 1][1] + stroke[i][1]) / 2]
    variance += (dist(mid, [cx, cy]) - r) ** 2 * seg
    len += seg
  }
  if (Math.abs(sweep) < (CIRCLE.minSweep * Math.PI) / 180) return 0

  const wobble = Math.sqrt(variance / len) / r
  const gap = dist(stroke[0], stroke[stroke.length - 1]) / r
  const score = 100 * (1 - 4 * wobble) - 25 * Math.max(0, gap - 0.15)
  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10
}

// Higher score takes it; a dead level (to the decimal shown) or two blanks go to nobody.
export function circleRoundWinner(round: CircleRound): PlayerId | null {
  const { A, B } = round.score
  if (A === null || B === null || A === B) return null
  return A > B ? 'A' : 'B'
}

// ---------------------------------------------------------------- Stop the Clock

export function clockRoundWinner(round: ClockRound): PlayerId | null {
  const { A, B } = round.stopped
  if (A === null || B === null) return null
  const dA = Math.abs(A - round.targetMs)
  const dB = Math.abs(B - round.targetMs)
  if (Math.abs(dA - dB) < CLOCK.deadHeatMs) return null
  return dA < dB ? 'A' : 'B'
}

// ---------------------------------------------------------------- either filler

export type Filler = { kind: 'circle'; game: CircleGame } | { kind: 'clock'; game: ClockGame }

export function roundWins(f: Filler): Record<PlayerId, number> {
  const wins = { A: 0, B: 0 }
  const winners = f.kind === 'circle'
    ? f.game.rounds.map(circleRoundWinner)
    : f.game.rounds.map(clockRoundWinner)
  for (const w of winners) if (w) wins[w] += 1
  return wins
}

// Over once someone has a majority of the best-of. Otherwise a circle stops after its
// best-of rounds; a clock can replay dead heats, up to two extra rounds.
export function fillerOver(f: Filler): boolean {
  const need = Math.ceil(f.game.bestOf / 2)
  const wins = roundWins(f)
  if (wins.A >= need || wins.B >= need) return true
  const cap = f.kind === 'circle' ? f.game.bestOf : f.game.bestOf + 2
  return f.game.rounds.length >= cap
}

export function fillerWinner(f: Filler): PlayerId | null {
  const wins = roundWins(f)
  if (wins.A === wins.B) return null
  return wins.A > wins.B ? 'A' : 'B'
}
