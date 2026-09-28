import { describe, it, expect } from 'vitest'
import { initialState, type Game, type SessionState } from './state'
import { reduce } from './reducer'
import { followWinner } from './fillers'
import { gameScores } from './standing'
import { DURATIONS, FILLER, FOLLOW, FRENZY, SPOT } from './phases'
import { roster } from './roster'

// The three quick fillers on their own: Spot It, Frenzy and Follow Me.
const start = (game: Game) => {
  let s = initialState(1, game)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}
const points = (s: SessionState, key: string) => gameScores(s).find((g) => g.key === key)!.points

describe('Spot It', () => {
  it('counts down, then deals the same grid to both — one odd cell, growing each round', () => {
    let s = start('spot')
    expect(s.phase).toBe('SPOT_READY')
    expect(s.phaseEndsAt).toBe(1000 + DURATIONS.SPOT_READY!)
    const r = s.spot!.rounds[0]
    expect(r.size).toBe(SPOT.firstSize)
    expect(r.base).not.toBe(r.odd)
    expect(r.at).toBeGreaterThanOrEqual(0)
    expect(r.at).toBeLessThan(r.size * r.size)
    s = reduce(s, { type: 'TIMEOUT' }, 4000)
    expect(s.phase).toBe('SPOT_RUN')
  })
  it('the quicker find takes the round, then the next grid is bigger; first to three wins', () => {
    let s = reduce(start('spot'), { type: 'TIMEOUT' }, 4000)
    for (let i = 0; i < 3; i++) {
      expect(s.phase).toBe('SPOT_RUN')
      s = reduce(s, { type: 'SPOT_FOUND', player: 'A', ms: 1200 }, 5000)
      s = reduce(s, { type: 'SPOT_FOUND', player: 'A', ms: 9999 }, 5000) // only the first counts
      s = reduce(s, { type: 'SPOT_FOUND', player: 'B', ms: 2500 }, 5000)
      expect(s.phase).toBe('SPOT_REVEAL')
      expect(s.spot!.rounds[i].found).toEqual({ A: 1200, B: 2500 })
      s = reduce(s, { type: 'TIMEOUT' }, 6000)
      if (i < 2) {
        expect(s.spot!.rounds[i + 1].size).toBe(SPOT.firstSize + i + 1)
        s = reduce(s, { type: 'TIMEOUT' }, 7000)
      }
    }
    expect(s.phase).toBe('SPOT_RESULT')
    expect(points(s, 'spot')).toEqual({ A: FILLER.winPoints, B: 0 })
  })
  it('finding it at all beats not finding it', () => {
    let s = reduce(start('spot'), { type: 'TIMEOUT' }, 4000)
    s = reduce(s, { type: 'SPOT_FOUND', player: 'B', ms: 15000 }, 5000)
    s = reduce(s, { type: 'TIMEOUT' }, 25000)
    expect(s.phase).toBe('SPOT_REVEAL')
    expect(s.spot!.rounds[0].found).toEqual({ A: null, B: 15000 })
  })
})

describe('Frenzy', () => {
  it('most taps takes it; a count arrives once, and never more than a finger could do', () => {
    let s = start('frenzy')
    expect(s.phase).toBe('FRENZY_READY')
    s = reduce(s, { type: 'TIMEOUT' }, 4000)
    expect(s.phase).toBe('FRENZY_RUN')
    expect(s.phaseEndsAt).toBe(4000 + FRENZY.runMs + FRENZY.graceMs)
    s = reduce(s, { type: 'FRENZY_TAPS', player: 'A', taps: 999 }, 9000)
    s = reduce(s, { type: 'FRENZY_TAPS', player: 'A', taps: 3 }, 9000)
    s = reduce(s, { type: 'FRENZY_TAPS', player: 'B', taps: 41 }, 9000)
    expect(s.frenzy!.rounds[0].taps).toEqual({ A: FRENZY.maxTaps, B: 41 })
    expect(s.phase).toBe('FRENZY_REVEAL')
  })
  it('a level round is played again', () => {
    let s = reduce(start('frenzy'), { type: 'TIMEOUT' }, 4000)
    s = reduce(s, { type: 'FRENZY_TAPS', player: 'A', taps: 30 }, 9000)
    s = reduce(s, { type: 'FRENZY_TAPS', player: 'B', taps: 30 }, 9000)
    s = reduce(s, { type: 'TIMEOUT' }, 12000)
    expect(s.phase).toBe('FRENZY_READY')
    expect(s.frenzy!.rounds).toHaveLength(2)
  })
})

describe('Follow Me', () => {
  const round = (s: SessionState) => s.follow!.rounds[s.follow!.current]
  it('shows a sequence that never repeats a pad back to back, then waits for you both to play it', () => {
    let s = start('follow')
    expect(s.phase).toBe('FOLLOW_SHOW')
    const seq = s.follow!.sequence
    expect(seq).toHaveLength(FOLLOW.maxLength)
    expect(seq.every((p, i) => p >= 0 && p < FOLLOW.pads && p !== seq[i - 1])).toBe(true)
    expect(round(s).length).toBe(FOLLOW.firstLength)
    s = reduce(s, { type: 'TIMEOUT' }, 5000)
    expect(s.phase).toBe('FOLLOW_PLAY')
  })
  it('grows while you both get it, and the first slip decides it — further along wins', () => {
    let s = reduce(start('follow'), { type: 'TIMEOUT' }, 5000)
    s = reduce(s, { type: 'FOLLOW_DONE', player: 'A', got: 3, ms: 2000 }, 6000)
    s = reduce(s, { type: 'FOLLOW_DONE', player: 'B', got: 3, ms: 2400 }, 6000)
    expect(s.phase).toBe('FOLLOW_REVEAL')
    s = reduce(s, { type: 'TIMEOUT' }, 7000)
    expect(s.phase).toBe('FOLLOW_SHOW')
    expect(round(s).length).toBe(FOLLOW.firstLength + 1)
    s = reduce(s, { type: 'TIMEOUT' }, 9000)
    s = reduce(s, { type: 'FOLLOW_DONE', player: 'A', got: 2, ms: 1500 }, 10000)
    s = reduce(s, { type: 'FOLLOW_DONE', player: 'B', got: 4, ms: 3000 }, 10000)
    expect(followWinner(s.follow!)).toBe('B')
    s = reduce(s, { type: 'TIMEOUT' }, 11000)
    expect(s.phase).toBe('FOLLOW_RESULT')
    expect(points(s, 'follow')).toEqual({ A: 0, B: FILLER.winPoints })
  })
  it('both slipping at the same step is nobody’s; running out of time is a slip', () => {
    let s = reduce(start('follow'), { type: 'TIMEOUT' }, 5000)
    s = reduce(s, { type: 'FOLLOW_DONE', player: 'A', got: 1, ms: 900 }, 6000)
    s = reduce(s, { type: 'TIMEOUT' }, 20000) // B never finished
    expect(round(s).result.B).toMatchObject({ got: 0 })
    expect(followWinner(s.follow!)).toBe('A')
  })
})

describe('the filler line-up', () => {
  it('takes every filler in turn on Today, and never the same one twice in a full night', () => {
    const tonight = new Set(Array.from({ length: 5 }, (_, n) => roster('tonight', n)[2].key))
    expect(tonight).toEqual(new Set(['clock', 'spot', 'circle', 'follow', 'frenzy']))
    for (let n = 0; n < 10; n++) {
      const fillers = roster('full', n).map((e) => e.key).filter((k) => ['circle', 'clock', 'spot', 'frenzy', 'follow'].includes(k))
      expect(fillers).toHaveLength(2)
      expect(fillers[0]).not.toBe(fillers[1])
    }
  })
})
