import { describe, it, expect } from 'vitest'
import type { MeldResult, MeldRound } from '../engine/state'
import { isAlreadySaid } from './meld'

function meldWith(roundWords: Array<[string | null, string | null]>): MeldResult {
  const rounds: MeldRound[] = roundWords.map(([a, b], i) => ({
    index: i + 1,
    words: { A: a, B: b },
    converged: false,
  }))
  return { rounds, roundsTaken: 0, converged: false, finalWord: null, seedPair: ['x', 'y'] }
}

describe('isAlreadySaid', () => {
  it('does NOT block matching the partner in the current round (the whole point)', () => {
    // Round 2 in progress: A already submitted "moon", B is trying to also say "moon".
    const meld = meldWith([['cat', 'dog'], ['moon', null]])
    const current = meld.rounds[1]
    expect(isAlreadySaid(meld, current, 'moon')).toBe(false)
  })

  it('blocks a word used in a prior completed round (death-spiral guard)', () => {
    const meld = meldWith([['cat', 'dog'], [null, null]])
    const current = meld.rounds[1]
    expect(isAlreadySaid(meld, current, 'cat')).toBe(true)
    expect(isAlreadySaid(meld, current, 'dog')).toBe(true)
  })

  it('folds case and plurals like the matcher', () => {
    const meld = meldWith([['Cat', 'dog'], [null, null]])
    const current = meld.rounds[1]
    expect(isAlreadySaid(meld, current, 'cats')).toBe(true)
  })

  it('allows a brand-new word', () => {
    const meld = meldWith([['cat', 'dog'], [null, null]])
    const current = meld.rounds[1]
    expect(isAlreadySaid(meld, current, 'moon')).toBe(false)
  })

  it('ignores empty/whitespace', () => {
    const meld = meldWith([['cat', 'dog'], [null, null]])
    const current = meld.rounds[1]
    expect(isAlreadySaid(meld, current, '   ')).toBe(false)
  })
})
