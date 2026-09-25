import { describe, it, expect } from 'vitest'
import { initialState, type Content, type DrawStroke, type Game, type SessionState } from './state'
import { reduce } from './reducer'
import { circleScore, keepCircle } from './fillers'
import { gameScores, standing } from './standing'
import { CLOCK, FILLER } from './phases'

const ring = (r: number, turns = 1, wobble = 0, n = 120): DrawStroke =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * turns * 2 * Math.PI
    const rr = r * (1 + wobble * Math.sin(a * 5))
    return [0.5 + rr * Math.cos(a), 0.5 + rr * Math.sin(a)] as [number, number]
  })

describe('circleScore', () => {
  it('scores a true circle near 100', () => {
    expect(circleScore(ring(0.35))).toBeGreaterThanOrEqual(99)
  })
  it('scores a wobbly circle lower, and a square lower still', () => {
    const wobbly = circleScore(ring(0.35, 1, 0.05))
    const square: DrawStroke = []
    for (const [x0, y0, x1, y1] of [[0.2, 0.2, 0.8, 0.2], [0.8, 0.2, 0.8, 0.8], [0.8, 0.8, 0.2, 0.8], [0.2, 0.8, 0.2, 0.2]]) {
      for (let i = 0; i < 30; i++) square.push([x0 + ((x1 - x0) * i) / 30, y0 + ((y1 - y0) * i) / 30])
    }
    square.push([0.2, 0.2])
    expect(wobbly).toBeLessThan(95)
    expect(wobbly).toBeGreaterThan(60)
    expect(circleScore(square)).toBeLessThan(wobbly)
  })
  it('gives nothing for a scribble that is too small, too short, or not round at all', () => {
    expect(circleScore(ring(0.1))).toBe(0) // too small
    expect(circleScore(ring(0.35, 0.75))).toBe(0) // a C, three quarters round
    expect(circleScore([[0.1, 0.1], [0.9, 0.9]])).toBe(0) // a line
    expect(circleScore([])).toBe(0)
    expect(circleScore(null)).toBe(0)
  })
  it('keeps only the longest stroke, thinned and rounded', () => {
    const kept = keepCircle([[[0.1, 0.1], [0.12, 0.1]], ring(0.3, 1, 0, 900)])
    expect(kept.length).toBeLessThanOrEqual(301)
    expect(kept.every(([x, y]) => x === Math.round(x * 1000) / 1000 && y === Math.round(y * 1000) / 1000)).toBe(true)
    expect(circleScore(kept)).toBeGreaterThan(98)
  })
})

const start = (game: Game, content: Partial<Content> = {}, night = 0) => {
  let s = initialState(1, game, content, night)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}

describe('Perfect Circle', () => {
  it('reveals once both are in, and the rounder circle takes the round', () => {
    let s = start('circle')
    expect(s.phase).toBe('CIRCLE_DRAW')
    s = reduce(s, { type: 'SUBMIT_CIRCLE', player: 'A', strokes: [ring(0.35)] }, 2000)
    expect(s.phase).toBe('CIRCLE_DRAW')
    // One go each: a second circle is ignored.
    expect(reduce(s, { type: 'SUBMIT_CIRCLE', player: 'A', strokes: [ring(0.35, 1, 0.2)] }, 2100)).toBe(s)
    s = reduce(s, { type: 'SUBMIT_CIRCLE', player: 'B', strokes: [ring(0.35, 1, 0.08)] }, 2200)
    expect(s.phase).toBe('CIRCLE_REVEAL')
    const round = s.circle!.rounds[0]
    expect(round.score.A!).toBeGreaterThan(round.score.B!)
  })
  it('plays a best of 5 on its own, ending as soon as someone has three, and pays the winner', () => {
    let s = start('circle')
    for (let r = 0; r < 3; r++) {
      s = reduce(s, { type: 'SUBMIT_CIRCLE', player: 'A', strokes: [ring(0.35)] }, 2000)
      s = reduce(s, { type: 'SUBMIT_CIRCLE', player: 'B', strokes: [ring(0.3, 1, 0.1)] }, 2000)
      // Leading isn't winning: nothing is paid until it's over.
      if (r < 2) expect(standing(s)).toEqual({ A: 0, B: 0 })
      s = reduce(s, { type: 'TIMEOUT' }, 3000)
    }
    expect(s.phase).toBe('CIRCLE_RESULT')
    expect(s.circle!.rounds).toHaveLength(3)
    expect(standing(s)).toEqual({ A: FILLER.winPoints, B: 0 })
  })
  it('counts a circle that never arrived as a blank, and a level round goes to nobody', () => {
    // Tonight on an odd night, with nothing for Finger Down or Wavelength: straight to the circle.
    let s = start('tonight', {}, 1)
    expect(s.phase).toBe('CIRCLE_DRAW')
    s = reduce(s, { type: 'TIMEOUT' }, 2000)
    expect(s.circle!.rounds[0].score).toEqual({ A: 0, B: 0 })
    s = reduce(s, { type: 'TIMEOUT' }, 3000)
    expect(s.phase).toBe('CIRCLE_RESULT') // best of 1 between games — no replay
    expect(gameScores(s).find((g) => g.key === 'circle')!.points).toEqual({ A: 0, B: 0 })
  })
})

// Straight to the running clock of a fresh standalone Stop the Clock.
const running = (game: Game = 'clock') => reduce(start(game), { type: 'TIMEOUT' }, 5000)

describe('Stop the Clock', () => {
  it('shows the target, then runs long enough for a tap at twice it', () => {
    let s = start('clock')
    expect(s.phase).toBe('CLOCK_READY')
    const target = s.clock!.rounds[0].targetMs
    expect(target).toBeGreaterThanOrEqual(CLOCK.targetMin)
    expect(target).toBeLessThanOrEqual(CLOCK.targetMax)
    expect(target % 100).toBe(0)
    s = reduce(s, { type: 'TIMEOUT' }, 5000)
    expect(s.phase).toBe('CLOCK_RUN')
    expect(s.phaseEndsAt).toBe(5000 + 2 * target + CLOCK.graceMs)
  })
  it('hides the clock sooner each round', () => {
    const s = start('clock')
    expect(s.clock!.rounds[0].hideAfterMs).toBe(3000)
  })
  it('takes one tap each, the closer wins, and a missing tap is the furthest miss', () => {
    let s = running()
    const t = s.clock!.rounds[0].targetMs
    s = reduce(s, { type: 'STOP_CLOCK', player: 'A', elapsedMs: t + 120 }, 6000)
    expect(reduce(s, { type: 'STOP_CLOCK', player: 'A', elapsedMs: t }, 6100)).toBe(s) // one tap
    s = reduce(s, { type: 'TIMEOUT' }, 9e9)
    expect(s.phase).toBe('CLOCK_REVEAL')
    expect(s.clock!.rounds[0].stopped).toEqual({ A: t + 120, B: 2 * t })
  })
  it('clamps a silly elapsed time and ignores a tap outside the run', () => {
    let s = start('clock')
    expect(reduce(s, { type: 'STOP_CLOCK', player: 'A', elapsedMs: 5000 }, 2000)).toBe(s) // still READY
    s = reduce(s, { type: 'TIMEOUT' }, 5000)
    s = reduce(s, { type: 'STOP_CLOCK', player: 'A', elapsedMs: -50 }, 6000)
    s = reduce(s, { type: 'STOP_CLOCK', player: 'B', elapsedMs: 1e9 }, 6000)
    const r = s.clock!.rounds[0]
    expect(r.stopped).toEqual({ A: 0, B: 2 * r.targetMs })
  })
  it('replays a dead heat, and a best of 5 ends as soon as someone has three', () => {
    let s = running()
    // Round 1: both exactly on it — a dead heat, so it doesn't count.
    let t = s.clock!.rounds[0].targetMs
    s = reduce(s, { type: 'STOP_CLOCK', player: 'A', elapsedMs: t }, 6000)
    s = reduce(s, { type: 'STOP_CLOCK', player: 'B', elapsedMs: t + 5 }, 6000)
    s = reduce(s, { type: 'TIMEOUT' }, 7000) // out of the reveal
    expect(s.phase).toBe('CLOCK_READY')
    for (let r = 0; r < 3; r++) {
      s = reduce(s, { type: 'TIMEOUT' }, 8000)
      t = s.clock!.rounds[s.clock!.current].targetMs
      s = reduce(s, { type: 'STOP_CLOCK', player: 'A', elapsedMs: t + 50 }, 9000)
      s = reduce(s, { type: 'STOP_CLOCK', player: 'B', elapsedMs: t + 400 }, 9000)
      s = reduce(s, { type: 'TIMEOUT' }, 10000)
    }
    expect(s.phase).toBe('CLOCK_RESULT')
    expect(s.clock!.rounds).toHaveLength(4)
    expect(s.clock!.rounds[3].hideAfterMs).toBe(0) // never shown by round 4
    expect(standing(s)).toEqual({ A: FILLER.winPoints, B: 0 })
  })
})

describe('the tiebreaker', () => {
  // Tonight, night 0, with nothing but the filler and Lights Out to play.
  const toDecider = () => {
    let s: SessionState = start('tonight', { lightsQuestions: ['Goodnight?'] })
    for (let i = 0; i < 40 && !s.phase.startsWith('DECIDER'); i++) {
      s = s.phase === 'CLOCK_RESULT' ? reduce(s, { type: 'CONTINUE', player: 'A' }, 1000 * i) : reduce(s, { type: 'TIMEOUT' }, 1000 * i)
    }
    return s
  }
  it('comes before Lights Out on a level night, and pays one point to break the tie', () => {
    let s = toDecider()
    expect(s.phase).toBe('DECIDER_READY')
    expect(standing(s)).toEqual({ A: 0, B: 0 })
    s = reduce(s, { type: 'TIMEOUT' }, 1e6)
    const t = s.decider!.rounds[0].targetMs
    s = reduce(s, { type: 'STOP_CLOCK', player: 'A', elapsedMs: t + 900 }, 1e6)
    s = reduce(s, { type: 'STOP_CLOCK', player: 'B', elapsedMs: t - 30 }, 1e6)
    expect(s.phase).toBe('DECIDER_REVEAL')
    s = reduce(s, { type: 'TIMEOUT' }, 2e6)
    expect(s.phase).toBe('LIGHTS_OUT')
    expect(standing(s)).toEqual({ A: 0, B: FILLER.deciderPoints })
    expect(gameScores(s).slice(-1)[0]).toMatchObject({ key: 'decider', label: 'Tiebreaker' })
  })
  it('is skipped when someone is ahead', () => {
    let s = start('tonight', { lightsQuestions: ['Goodnight?'] })
    s = reduce(s, { type: 'TIMEOUT' }, 2000) // into the run
    for (let r = 0; r < 2; r++) {
      const t = s.clock!.rounds[s.clock!.current].targetMs
      s = reduce(s, { type: 'STOP_CLOCK', player: 'A', elapsedMs: t }, 3000)
      s = reduce(s, { type: 'STOP_CLOCK', player: 'B', elapsedMs: t + 500 }, 3000)
      s = reduce(s, { type: 'TIMEOUT' }, 4000) // out of the reveal
      if (s.phase === 'CLOCK_READY') s = reduce(s, { type: 'TIMEOUT' }, 5000)
    }
    expect(s.phase).toBe('CLOCK_RESULT')
    s = reduce(s, { type: 'CONTINUE', player: 'A' }, 6000)
    expect(s.phase).toBe('LIGHTS_OUT')
    expect(s.decider).toBe(null)
  })
  it('never plays after a single game played on its own', () => {
    let s = running('clock')
    for (let i = 0; i < 30 && s.phase !== 'CLOCK_RESULT'; i++) s = reduce(s, { type: 'TIMEOUT' }, 1000 * i)
    s = reduce(s, { type: 'CONTINUE', player: 'A' }, 1e6)
    expect(s.phase).toBe('DONE')
    expect(s.decider).toBe(null)
  })
})
