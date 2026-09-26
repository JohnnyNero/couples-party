import { describe, it, expect } from 'vitest'
import { initialState, type Content, type PlayerId, type SessionState } from './state'
import { reduce } from './reducer'
import { roundsFor } from './roster'
import { SCORING, bluffPoints, standing } from './standing'
import { DURATIONS } from './phases'

const CONTENT: Partial<Content> = {
  bluffPrompts: ['[Your|@’s] worst ever gift', 'A food [you|@] secretly hate[|s]', 'Something [you|@] did as a kid'],
}

const start = () => {
  let s = initialState(1, 'bluff', CONTENT)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}
const write = (s: SessionState, p: PlayerId, truth = 'socks') =>
  reduce(s, { type: 'SUBMIT_BLUFF', player: p, truth, lies: ['a pony', 'a car'] }, 2000)
const round = (s: SessionState) => s.bluff!.rounds[s.bluff!.current]

describe('two lies & a truth', () => {
  it('deals a prompt per round and waits for both of you to write', () => {
    let s = start()
    expect(s.phase).toBe('BLUFF_WRITE')
    expect(s.bluff!.rounds).toHaveLength(roundsFor(s, 'bluff'))
    expect(round(s).order.A.slice().sort()).toEqual([0, 1, 2])
    s = write(s, 'A')
    expect(s.phase).toBe('BLUFF_WRITE')
    // A blank lie isn't a lie: turned back.
    expect(reduce(s, { type: 'SUBMIT_BLUFF', player: 'B', truth: 'x', lies: ['y', ' '] }, 2000)).toBe(s)
    s = write(s, 'B')
    expect(s.phase).toBe('BLUFF_PICK')
    expect(s.phaseEndsAt).toBe(2000 + DURATIONS.BLUFF_PICK!)
  })

  it('takes one of you at a time: the other picks, then the truth is shown', () => {
    let s = write(write(start(), 'A'), 'B')
    const first = round(s).first
    const guesser = first === 'A' ? 'B' : 'A'
    expect(round(s).turn).toBe(first)
    // The one whose three they are can't pick.
    expect(reduce(s, { type: 'PICK_BLUFF', player: first, choice: 0 }, 3000)).toBe(s)
    s = reduce(s, { type: 'PICK_BLUFF', player: guesser, choice: 0 }, 3000)
    expect(s.phase).toBe('BLUFF_REVEAL')
    expect(s.phaseEndsAt).toBeNull()
    expect(bluffPoints(s.bluff)[guesser]).toBe(SCORING.bluffSpotted)
    s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'A' }, 4000)
    expect(s.phase).toBe('BLUFF_PICK')
    expect(round(s).turn).toBe(guesser)
    s = reduce(s, { type: 'PICK_BLUFF', player: first, choice: 2 }, 5000)
    expect(bluffPoints(s.bluff)).toEqual({ [guesser]: SCORING.bluffSpotted + SCORING.bluffFooled, [first]: 0 })
    s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'B' }, 6000)
    expect(s.phase).toBe('BLUFF_WRITE')
    expect(s.bluff!.current).toBe(1)
    expect(round(s).first).not.toBe(first) // swaps each round
  })

  it('counts running out of time as fooled, and skips anyone who never wrote', () => {
    let s = write(start(), 'A')
    s = reduce(s, { type: 'TIMEOUT' }, 200000) // Alex never sent theirs
    expect(s.phase).toBe('BLUFF_PICK')
    expect(round(s).turn).toBe('A')
    s = reduce(s, { type: 'TIMEOUT' }, 300000)
    expect(round(s).pick.A).toBe(-1)
    expect(bluffPoints(s.bluff)).toEqual({ A: SCORING.bluffFooled, B: 0 })
    s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'A' }, 300001)
    expect(s.phase).toBe('BLUFF_WRITE') // nothing of Alex's to guess
  })

  it('ends on a scoreboard after the last round, with a ceiling near the others', () => {
    let s = start()
    for (let r = 0; r < roundsFor(s, 'bluff'); r++) {
      s = write(write(s, 'A'), 'B')
      for (let t = 0; t < 2; t++) {
        const guesser = round(s).turn === 'A' ? 'B' : 'A'
        s = reduce(s, { type: 'PICK_BLUFF', player: guesser, choice: guesser === 'A' ? 0 : 1 }, 3000)
        s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'A' }, 3000)
      }
    }
    expect(s.phase).toBe('BLUFF_RESULT')
    const total = 3 * (SCORING.bluffSpotted + SCORING.bluffFooled)
    expect(standing(s)).toEqual({ A: total, B: 0 })
    expect(total).toBeGreaterThanOrEqual(36)
    expect(total).toBeLessThanOrEqual(45)
  })
})

describe('two lies & a truth, remembered', () => {
  it('keeps each truth and whether it was spotted', async () => {
    const { sessionMemory } = await import('../memories/summary')
    let s = write(write(start(), 'A', 'a llama'), 'B', 'a kazoo')
    const guesser = round(s).turn === 'A' ? 'B' : 'A'
    s = reduce(s, { type: 'PICK_BLUFF', player: guesser, choice: 0 }, 3000)
    const m = sessionMemory(s)
    expect(m.bluff).toHaveLength(1)
    expect(m.bluff![0].prompt).toBe('Your worst ever gift')
    expect(m.bluff![0].truth).toEqual({ A: 'a llama', B: 'a kazoo' })
    expect(m.bluff![0].spotted[round(s).turn]).toBe(true)
  })
})
