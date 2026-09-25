import { describe, it, expect } from 'vitest'
import { initialState } from './state'
import { canPause, reduce } from './reducer'

function mrmrs() {
  let s = initialState(7, 'mrmrs', { mrmrsQuestions: ['Your comfort meal?', 'Your go-to drink?'] })
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
  expect(s.phase).toBe('MM_ANSWER')
  return s
}

describe('pause', () => {
  it('stops the clock, keeps what was left, and gives it back on resume', () => {
    const s = mrmrs()
    const ends = s.phaseEndsAt!
    const p = reduce(s, { type: 'PAUSE', player: 'B' }, ends - 20000)
    expect(p.paused).toEqual({ by: 'B', leftMs: 20000 })
    expect(p.phaseEndsAt).toBe(null)
    const r = reduce(p, { type: 'RESUME', player: 'A' }, 1_000_000)
    expect(r.paused).toBe(null)
    expect(r.phaseEndsAt).toBe(1_000_000 + 20000)
  })

  it('holds everything while paused', () => {
    const p = reduce(mrmrs(), { type: 'PAUSE', player: 'A' }, 1000)
    expect(reduce(p, { type: 'SUBMIT_MRMRS', player: 'A', answer: 'soup', predict: 'tea' }, 2000)).toBe(p)
    expect(reduce(p, { type: 'TIMEOUT' }, 999_999)).toBe(p)
    expect(reduce(p, { type: 'PAUSE', player: 'B' }, 3000)).toBe(p) // already paused
  })

  it('never resumes straight into a timeout', () => {
    const s = mrmrs()
    const p = reduce(s, { type: 'PAUSE', player: 'A' }, s.phaseEndsAt! - 100)
    expect(reduce(p, { type: 'RESUME', player: 'A' }, 5000).phaseEndsAt).toBe(7000)
  })

  it("isn't offered before the game starts, or mid Stop the Clock", () => {
    expect(canPause(initialState(1, 'mrmrs', {}))).toBe(false) // JOIN
    let c = initialState(3, 'clock', {})
    c = reduce(c, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
    c = reduce(c, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
    expect(c.phase).toBe('CLOCK_READY')
    expect(canPause(c)).toBe(false)
    expect(reduce(c, { type: 'PAUSE', player: 'A' }, 10)).toBe(c)
  })
})
