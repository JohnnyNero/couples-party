import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from './state'
import { reduce } from './reducer'
import { roundsFor } from './roster'
import { MELD } from './phases'
import { MELD_POINTS, shown, standing, teamScore } from './standing'

const start = () => {
  let s = initialState(1, 'meld', { meldPrompts: ['A pizza topping', 'Our go-to takeaway', 'A cereal', 'A superhero', 'A board game'] })
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}
const say = (s: SessionState, a: string, b: string) => {
  s = reduce(s, { type: 'SUBMIT_MELD', player: 'A', word: a }, 2000)
  return reduce(s, { type: 'SUBMIT_MELD', player: 'B', word: b }, 2000)
}
const round = (s: SessionState) => s.meld!.rounds[s.meld!.current]

describe('mind meld', () => {
  it('waits for both words, then shows them; saying the same thing is a meld', () => {
    let s = reduce(start(), { type: 'SUBMIT_MELD', player: 'A', word: 'Pepperoni' }, 2000)
    expect(s.phase).toBe('MELD_WRITE')
    s = reduce(s, { type: 'SUBMIT_MELD', player: 'B', word: 'pepperoni ' }, 2000)
    expect(s.phase).toBe('MELD_REVEAL')
    expect(round(s).matched).toBe(0)
    expect(teamScore(s)).toBe(shown(s, 'meld', MELD_POINTS[0], 'us'))
    expect(standing(s)).toEqual({ A: 0, B: 0 }) // a team game: nobody wins it
    s = reduce(s, { type: 'TIMEOUT' }, 9000)
    expect(s.meld!.current).toBe(1)
    expect(s.phase).toBe('MELD_WRITE')
  })
  it('goes again after a miss, up to three tries, worth less each time', () => {
    let s = say(start(), 'ham', 'pineapple')
    expect(round(s).matched).toBeNull()
    s = reduce(s, { type: 'TIMEOUT' }, 9000)
    expect(s.phase).toBe('MELD_WRITE')
    expect(round(s).tries).toHaveLength(2)
    s = say(s, 'hawaiian', 'hawaiian')
    expect(round(s).matched).toBe(1)
    expect(teamScore(s)).toBe(shown(s, 'meld', MELD_POINTS[1], 'us'))
  })
  it('moves on after three misses, with nothing for that prompt', () => {
    let s = start()
    for (let t = 0; t < 3; t++) {
      s = say(s, `a${t}`, `b${t}`)
      s = reduce(s, { type: 'TIMEOUT' }, 9000 + t)
    }
    expect(s.meld!.current).toBe(1)
    expect(teamScore(s)).toBe(0)
  })
  it('a word nobody sent never meets, and the last prompt ends on the scoreboard', () => {
    let s = start()
    for (let i = 0; i < 100 && s.phase !== 'MELD_RESULT'; i++) s = reduce(s, { type: 'TIMEOUT' }, 1000 + i * 100000)
    expect(s.phase).toBe('MELD_RESULT')
    expect(s.meld!.rounds).toHaveLength(roundsFor(s, 'meld'))
    expect(s.meld!.rounds.every((r) => r.matched === null)).toBe(true)
  })
  it('lets either of you count a near miss — "same thing, different words" — as a meld', () => {
    let s = say(start(), 'sofa', 'couch')
    expect(s.phase).toBe('MELD_REVEAL')
    expect(s.meld!.rounds[0].matched).toBe(null)
    expect(s.phaseEndsAt).toBe(2000 + MELD.missRevealMs) // a miss waits longer, for the argument
    // Only about the go that's up.
    expect(reduce(s, { type: 'COUNT_MELD', player: 'B', try: 1 }, 3000)).toBe(s)
    s = reduce(s, { type: 'COUNT_MELD', player: 'B', try: 0 }, 3000)
    expect(s.meld!.rounds[0].matched).toBe(0)
    expect(s.meld!.rounds[0].counted).toBe(true)
    expect(teamScore(s)).toBe(shown(s, 'meld', MELD_POINTS[0], 'us'))
    // Once is enough.
    expect(reduce(s, { type: 'COUNT_MELD', player: 'A', try: 0 }, 3100)).toBe(s)
    // …and the round is done: the next prompt, not another try.
    s = reduce(s, { type: 'TIMEOUT' }, 9e9)
    expect(s.meld!.current).toBe(1)
  })
  it('never counts a blank', () => {
    let s = reduce(start(), { type: 'SUBMIT_MELD', player: 'A', word: 'sofa' }, 2000)
    s = reduce(s, { type: 'TIMEOUT' }, 9e9)
    expect(s.phase).toBe('MELD_REVEAL')
    expect(reduce(s, { type: 'COUNT_MELD', player: 'A', try: 0 }, 9e9)).toBe(s)
  })
})
