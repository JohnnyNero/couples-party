import { describe, it, expect } from 'vitest'
import { initialState, type Content, type SessionState } from './state'
import { adopt, reduce } from './reducer'
import { standing } from './standing'
import { DURATIONS } from './phases'

const CONTENT: Partial<Content> = {
  mrmrsQuestions: ['Your comfort meal?', 'Your go-to drink?', 'Your first gig?', 'Your worst habit?', 'Your dream job?'],
}
const start = () => {
  let s = initialState(1, 'mrmrs', CONTENT)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}
const answer = (s: SessionState, t: number) => {
  s = reduce(s, { type: 'SUBMIT_MRMRS', player: 'A', answer: 'pasta', predict: 'curry' }, t)
  return reduce(s, { type: 'SUBMIT_MRMRS', player: 'B', answer: 'curry', predict: 'pasta' }, t)
}

describe('one of you leaving', () => {
  it('pauses the game with the clock where it was, and nothing moves meanwhile', () => {
    let s = start() // MM_ANSWER, clock ends at 1000 + 45000
    s = reduce(s, { type: 'AWAY', player: 'B' }, 11000)
    expect(s.players.B.connected).toBe(false)
    expect(s.paused).toEqual({ by: 'B', leftMs: DURATIONS.MM_ANSWER! - 10000, away: true })
    expect(s.phaseEndsAt).toBeNull()
    expect(reduce(s, { type: 'SUBMIT_MRMRS', player: 'A', answer: 'x', predict: 'y' }, 12000)).toBe(s)
    expect(reduce(s, { type: 'TIMEOUT' }, 999999)).toBe(s)
    // Nobody can resume it without them.
    expect(reduce(s, { type: 'RESUME', player: 'A' }, 12000)).toBe(s)
  })
  it('carries on by itself once they rejoin, with at least a few seconds on the clock', () => {
    let s = reduce(start(), { type: 'AWAY', player: 'B' }, 45000) // 1s left
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 90000)
    expect(s.paused).toBeNull()
    expect(s.players.B.connected).toBe(true)
    expect(s.phaseEndsAt).toBe(90000 + 5000)
    expect(s.phase).toBe('MM_ANSWER')
  })
  it('only marks you gone before the game has started, or once it is over', () => {
    let s = initialState(1, 'mrmrs', CONTENT)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'AWAY', player: 'A' }, 2000)
    expect(s.paused).toBeNull()
    expect(s.players.A.connected).toBe(false)
  })
})

describe('picking a saved game back up', () => {
  it('keeps every answer and point, and waits for you both before carrying on', () => {
    let s = answer(start(), 2000)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 2000)
    const before = standing(s)
    let back = adopt(s, 50000)
    expect(back.players.A.connected).toBe(false)
    expect(back.players.B.connected).toBe(false)
    expect(back.paused?.away).toBe(true)
    expect(back.mrmrs).toEqual(s.mrmrs)
    back = reduce(back, { type: 'JOIN', player: 'B', name: 'Alex' }, 60000)
    expect(back.paused?.away).toBe(true) // still waiting for Sam
    back = reduce(back, { type: 'JOIN', player: 'A', name: 'Sam' }, 61000)
    expect(back.paused).toBeNull()
    expect(back.phase).toBe(s.phase)
    expect(standing(back)).toEqual(before)
  })
})
