import { describe, it, expect } from 'vitest'
import { initialState, type FingerGame, type ListAct, type ListItem, type PlayerId, type WaveRound } from './state'
import { listAward, listItemPoints, standing, leader, fingerAward, waveAward } from './standing'

// Each pair is one item: [where the ranker put it, where the author guessed].
const items = (pairs: Array<[number | null, number | null]>): ListItem[] =>
  pairs.map(([actualSlot, predictedSlot], i) => ({
    id: `i${i}`, text: `item ${i}`, actualSlot, predictedSlot,
  }))

const act = (
  author: PlayerId,
  displacement: number | null,
  pairs: Array<[number | null, number | null]> = [],
  revealIndex = Math.max(0, pairs.length - 1),
): ListAct => ({
  author, themeId: 't001', items: items(pairs), placeIndex: 0, revealIndex, displacement,
})

const withActs = (...acts: ListAct[]) => ({ ...initialState(1), listActs: acts })

const finger = (a: number, b: number): FingerGame => ({
  rounds: [], current: 0, fingersLeft: { A: a, B: b },
})

const wRound = (psychic: PlayerId, distance: number | null): WaveRound => ({
  index: 1, psychic, spectrumId: 'w01', target: 50, clue: 'x', guess: 50, distance,
})

describe('listItemPoints', () => {
  const item = (actualSlot: number | null, predictedSlot: number | null): ListItem =>
    ({ id: 'x', text: 'x', actualSlot, predictedSlot })

  it('pays 3 for landing on the ranker\'s exact slot', () => {
    expect(listItemPoints(item(4, 4))).toBe(3)
  })
  it('pays 1 for being a single place out, either way', () => {
    expect(listItemPoints(item(4, 3))).toBe(1)
    expect(listItemPoints(item(4, 5))).toBe(1)
  })
  it('pays nothing from two places out', () => {
    expect(listItemPoints(item(4, 2))).toBe(0)
    expect(listItemPoints(item(1, 7))).toBe(0)
  })
  it('pays nothing for an item either side never placed', () => {
    expect(listItemPoints(item(null, 3))).toBe(0)
    expect(listItemPoints(item(3, null))).toBe(0)
  })
})

describe('listAward', () => {
  it('sums the items and pays the author, who is the one guessing', () => {
    // exact (3) + one out (1) + miles off (0) = 4
    expect(listAward(act('A', 6, [[1, 1], [2, 3], [3, 7]]))).toEqual({ player: 'A', points: 4 })
    expect(listAward(act('B', 6, [[1, 1], [2, 3], [3, 7]]))).toEqual({ player: 'B', points: 4 })
  })
  it('pays a perfect read the full 21', () => {
    const perfect: Array<[number, number]> = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7]]
    expect(listAward(act('A', 0, perfect))).toEqual({ player: 'A', points: 21 })
  })
  it('counts only the items the reveal has walked past, so the score climbs with it', () => {
    const pairs: Array<[number, number]> = [[1, 1], [2, 2], [3, 3]]
    expect(listAward(act('A', 0, pairs, 0))).toEqual({ player: 'A', points: 3 })
    expect(listAward(act('A', 0, pairs, 1))).toEqual({ player: 'A', points: 6 })
    expect(listAward(act('A', 0, pairs, 2))).toEqual({ player: 'A', points: 9 })
  })
  it('awards nothing for an act still being placed, or one read this badly', () => {
    expect(listAward(act('A', null, [[1, 1]]))).toBe(null)
    expect(listAward(act('A', 12, [[1, 7], [2, 5]]))).toBe(null)
  })
})

describe('fingerAward', () => {
  it('awards 2 to whoever has more fingers left', () => {
    expect(fingerAward(finger(3, 1))).toEqual({ player: 'A', points: 2 })
    expect(fingerAward(finger(1, 3))).toEqual({ player: 'B', points: 2 })
  })
  it('awards nothing on a level hand, or no game at all', () => {
    expect(fingerAward(finger(2, 2))).toBe(null)
    expect(fingerAward(null)).toBe(null)
  })
})

describe('waveAward', () => {
  it('awards the psychic on a bullseye, tapering with distance', () => {
    expect(waveAward(wRound('A', 0))).toEqual({ player: 'A', points: 3 })
    expect(waveAward(wRound('A', 5))).toEqual({ player: 'A', points: 2 })
    expect(waveAward(wRound('A', 15))).toEqual({ player: 'A', points: 1 })
  })
  it('moves nothing in the middle band', () => {
    expect(waveAward(wRound('A', 16))).toBe(null)
    expect(waveAward(wRound('A', 30))).toBe(null)
  })
  it('gives the guesser a point on a very wide miss', () => {
    expect(waveAward(wRound('A', 31))).toEqual({ player: 'B', points: 1 })
    expect(waveAward(wRound('B', 90))).toEqual({ player: 'A', points: 1 })
  })
  it('awards nothing for an unresolved round', () => {
    expect(waveAward(wRound('A', null))).toBe(null)
  })
})

describe('standing', () => {
  it('is zero-zero before anything resolves', () => {
    expect(standing(initialState(1))).toEqual({ A: 0, B: 0 })
    expect(leader(initialState(1))).toBe(null)
  })
  it('sums both runs of the act, each paying its own author', () => {
    const s = withActs(act('A', 0, [[1, 1], [2, 2]]), act('B', 4, [[1, 2], [2, 4]]))
    expect(standing(s)).toEqual({ A: 6, B: 1 }) // A: two exacts; B: one out, then miles off
    expect(leader(s)).toBe('A')
  })
  it('reports level as null', () => {
    expect(leader(withActs(act('A', 2, [[1, 2]]), act('B', 2, [[3, 4]])))).toBe(null)
  })
  it('folds in Put a Finger Down alongside Shortlist', () => {
    const s = { ...withActs(act('A', 0, [[1, 1]])), finger: finger(1, 4) }
    expect(standing(s)).toEqual({ A: 3, B: 2 }) // A's exact hit (3), B's 2 from fingers
  })
  it('sums Wavelength across every round played so far', () => {
    const s = { ...initialState(1), wave: { rounds: [wRound('A', 0), wRound('B', 5), wRound('A', null)], current: 2 } }
    expect(standing(s)).toEqual({ A: 3, B: 2 }) // A's bullseye (3), B's close guess (2); round 3 unresolved
  })
})
