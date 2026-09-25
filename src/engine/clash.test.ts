import { describe, it, expect } from 'vitest'
import { initialState, type Game, type SessionState } from './state'
import { reduce } from './reducer'
import { clashNorm, clashVerdict, startsRight, CLASH_POINTS } from './clash'
import { standing } from './standing'
import { CLASH } from './phases'

const CATS = Array.from({ length: 24 }, (_, i) => `Category ${i + 1}`)

const start = (game: Game = 'clash') => {
  let s = initialState(1, game, { clashCategories: CATS })
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}
const round = (s: SessionState) => s.clash!.rounds[s.clash!.current]
// Six answers starting with this round's letter, each made unique by `tag`.
const answers = (s: SessionState, tag: string) => round(s).categories.map((_, i) => `${round(s).letter}${tag}${i}`)

describe('matching and letters', () => {
  it('treats answers as the same once case, articles, spacing and a plural are set aside', () => {
    expect(clashNorm('The Beatles')).toBe(clashNorm('beatle'))
    expect(clashNorm('Ice cream')).toBe(clashNorm('icecream'))
    expect(clashNorm('Crème brûlée')).toBe(clashNorm('creme brulee'))
    expect(clashNorm('bus')).not.toBe(clashNorm('bu')) // short words keep their s
  })
  it('accepts the letter as typed or after a leading article', () => {
    expect(startsRight('The Beatles', 'B')).toBe(true)
    expect(startsRight('Tea', 'T')).toBe(true)
    expect(startsRight('  banana', 'b')).toBe(true)
    expect(startsRight('Apple', 'B')).toBe(false)
  })
})

describe('Category Clash', () => {
  it('deals a letter and six categories per round, never repeating either within the game', () => {
    const s = start()
    expect(s.phase).toBe('CLASH_WRITE')
    const rounds = s.clash!.rounds
    expect(rounds).toHaveLength(3)
    expect(new Set(rounds.map((r) => r.letter)).size).toBe(3)
    for (const r of rounds) expect(CLASH.letters).toContain(r.letter)
    const all = rounds.flatMap((r) => r.categories)
    expect(all).toHaveLength(18)
    expect(new Set(all).size).toBe(18)
  })
  it('reveals once both are in, and scores 2 unique, 0 each for the same, 0 for blank or wrong letter', () => {
    let s = start()
    const L = round(s).letter
    const a = answers(s, 'x')
    const b = answers(s, 'y')
    b[1] = a[1].toUpperCase()   // the same answer as A's
    b[2] = ''                   // blank
    b[3] = 'zzz'                // wrong letter (Z is never dealt)
    s = reduce(s, { type: 'SUBMIT_CLASH', player: 'A', answers: a }, 2000)
    expect(s.phase).toBe('CLASH_WRITE')
    expect(reduce(s, { type: 'SUBMIT_CLASH', player: 'A', answers: b }, 2100)).toBe(s) // sent is sent
    s = reduce(s, { type: 'SUBMIT_CLASH', player: 'B', answers: b }, 2200)
    expect(s.phase).toBe('CLASH_REVEAL')
    expect(s.phaseEndsAt).toBe(null) // no clock on the argument
    const r = round(s)
    expect(r.letter).toBe(L)
    expect([0, 1, 2, 3].map((i) => clashVerdict(r, 'B', i))).toEqual(['scores', 'same', 'blank', 'wrong-letter'])
    expect(clashVerdict(r, 'A', 1)).toBe('same')
    // Only what's revealed counts: category 1 so far.
    expect(standing(s)).toEqual({ A: 2, B: 2 })
    for (let i = 0; i < 5; i++) s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'A' }, 3000)
    // A: five unique (not the matched one). B: categories 0, 4 and 5.
    expect(standing(s)).toEqual({ A: 10, B: 6 })
  })
  it('lets you challenge a scoring answer the reveal has reached, halving it', () => {
    let s = start()
    s = reduce(s, { type: 'SUBMIT_CLASH', player: 'A', answers: answers(s, 'x') }, 2000)
    s = reduce(s, { type: 'SUBMIT_CLASH', player: 'B', answers: answers(s, 'y') }, 2000)
    // Not yet reached: ignored.
    expect(reduce(s, { type: 'CHALLENGE', player: 'B', index: 3 }, 2500)).toBe(s)
    s = reduce(s, { type: 'CHALLENGE', player: 'B', index: 0 }, 2500)
    expect(round(s).challenged.A[0]).toBe(true)
    expect(clashVerdict(round(s), 'A', 0)).toBe('challenged')
    expect(standing(s)).toEqual({ A: CLASH_POINTS.challenged, B: 2 })
    // Once is enough; an answer already worth nothing can't be challenged.
    expect(reduce(s, { type: 'CHALLENGE', player: 'B', index: 0 }, 2600)).toBe(s)
  })
  it('counts a round nobody sent as all blanks', () => {
    let s = start()
    s = reduce(s, { type: 'TIMEOUT' }, 70000)
    expect(s.phase).toBe('CLASH_REVEAL')
    expect(round(s).answers.A).toEqual(['', '', '', '', '', ''])
    expect(standing(s)).toEqual({ A: 0, B: 0 })
  })
  it('walks round by round to its scoreboard, scoring nothing for a round still being written', () => {
    let s = start()
    for (let r = 0; r < 3; r++) {
      expect(s.phase).toBe('CLASH_WRITE')
      expect(s.clash!.current).toBe(r)
      // Round 1's points are banked; the round being written adds nothing yet.
      expect(standing(s)).toEqual({ A: 12 * r, B: 0 })
      s = reduce(s, { type: 'SUBMIT_CLASH', player: 'A', answers: answers(s, 'x') }, 2000)
      s = reduce(s, { type: 'SUBMIT_CLASH', player: 'B', answers: [] }, 2000)
      for (let i = 0; i < 6; i++) s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'B' }, 3000)
    }
    expect(s.phase).toBe('CLASH_RESULT')
    expect(standing(s)).toEqual({ A: 36, B: 0 })
  })
  it('skips itself when the content file has too few categories', () => {
    let s = initialState(1, 'clash', { clashCategories: ['one', 'two'] })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(s.phase).toBe('DONE')
  })
})
