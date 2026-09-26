import { describe, it, expect } from 'vitest'
import { initialState, type FingerGame, type ListAct, type ListItem, type PlayerId, type WaveRound } from './state'
import { listAward, listItemPoints, standing, leader, fingerPoints, gameScores, waveAward, drawAward, SCORING, shown } from './standing'

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

// Each entry is one statement: what each of you said about yourself, and each one's
// call on the other. A null answer means that player hasn't answered yet.
type Said = { A: [boolean | null, boolean | null]; B: [boolean | null, boolean | null] } // [answer, call]
const finger = (...said: Said[]): FingerGame => ({
  rounds: said.map((x, i) => ({
    index: i + 1, statementId: `f${i}`,
    answer: { A: x.A[0], B: x.B[0] }, predict: { A: x.A[1], B: x.B[1] },
  })),
  current: 0,
})
// A calls B right, B calls A wrong.
const aRight: Said = { A: [true, false], B: [false, false] }

const dRound = (drawer: PlayerId, correct: boolean | null) => ({
  index: 1, drawer, promptId: 'd01', answer: 'x', strokes: [], guess: correct === null ? null : 'x', correct,
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

describe('fingerPoints (Called It)', () => {
  const right = SCORING.calledRight
  it('pays each right call to whoever made it, and both of you can score', () => {
    expect(fingerPoints(finger(aRight))).toEqual({ A: right, B: 0 })
    expect(fingerPoints(finger({ A: [true, false], B: [false, true] }))).toEqual({ A: right, B: right })
  })
  it('pays nothing for a round one of you has not answered yet', () => {
    expect(fingerPoints(finger({ A: [true, false], B: [null, null] }))).toEqual({ A: 0, B: 0 })
  })
  it('pays nothing for a game that never happened', () => {
    expect(fingerPoints(null)).toEqual({ A: 0, B: 0 })
  })
})

describe('waveAward', () => {
  it('awards the clue-giver on a bullseye, tapering with distance', () => {
    expect(waveAward(wRound('A', 0))).toEqual({ player: 'A', points: SCORING.waveBullseye })
    expect(waveAward(wRound('A', 5))).toEqual({ player: 'A', points: SCORING.waveClose })
    expect(waveAward(wRound('A', 15))).toEqual({ player: 'A', points: SCORING.waveNear })
  })
  it('moves nothing in the middle band', () => {
    expect(waveAward(wRound('A', 16))).toBe(null)
    expect(waveAward(wRound('A', 30))).toBe(null)
  })
  it('gives the guesser something back on a very wide miss', () => {
    expect(waveAward(wRound('A', 31))).toEqual({ player: 'B', points: SCORING.waveConsolation })
    expect(waveAward(wRound('B', 90))).toEqual({ player: 'A', points: SCORING.waveConsolation })
  })
  it('awards nothing for an unresolved round', () => {
    expect(waveAward(wRound('A', null))).toBe(null)
  })
})

// Whether every game is worth the same to the night: see balance.test.ts.

describe('standing', () => {
  it('is zero-zero before anything resolves', () => {
    expect(standing(initialState(1))).toEqual({ A: 0, B: 0 })
    expect(leader(initialState(1))).toBe(null)
  })
  it('sums both runs of the act, each paying its own author', () => {
    const s = withActs(act('A', 0, [[1, 1], [2, 2]]), act('B', 4, [[1, 2], [2, 4]]))
    // A: two exacts; B: one out, then miles off — each award scaled on its own.
    const x = shown(s, 'list', SCORING.listExact), n = shown(s, 'list', SCORING.listNear)
    expect(standing(s)).toEqual({ A: 2 * x, B: n })
    expect(leader(s)).toBe('A')
  })
  it('reports level as null', () => {
    expect(leader(withActs(act('A', 2, [[1, 2]]), act('B', 2, [[3, 4]])))).toBe(null)
  })
  it('folds in Put a Finger Down alongside Shortlist', () => {
    // A guessed one item exactly; B made the one right call.
    const s = { ...withActs(act('A', 0, [[1, 1]])), finger: finger({ A: [true, true], B: [false, true] }) }
    expect(standing(s)).toEqual({ A: shown(s, 'list', SCORING.listExact), B: shown(s, 'finger', SCORING.calledRight) })
  })
  it('sums Wavelength across every round played so far', () => {
    const s = { ...initialState(1), wave: { rounds: [wRound('A', 0), wRound('B', 5), wRound('A', null)], current: 2 } }
    // A's bullseye, B's close guess; round 3 is unresolved and pays nothing.
    expect(standing(s)).toEqual({ A: shown(s, 'wave', SCORING.waveBullseye), B: shown(s, 'wave', SCORING.waveClose) })
  })
})

describe('gameScores', () => {
  it('breaks the total down by game, and says which have been played', () => {
    const s = { ...withActs(act('A', 0, [[1, 1]])), finger: finger({ A: [true, true], B: [false, true] }) }
    const rows = gameScores(s)
    // The full roster, in playing order. Lights Out isn't here — it doesn't score.
    expect(rows.map((g) => g.key)).toEqual(['list', 'finger', 'circle', 'wave', 'clash', 'clock', 'mrmrs', 'chain', 'draw', 'bluff', 'meld'])
    expect(rows.map((g) => g.played)).toEqual([true, true, false, false, false, false, false, false, false, false, false])
    expect(rows[0].points).toEqual({ A: shown(s, 'list', SCORING.listExact), B: 0 })
    expect(rows[0].team).toBe(shown(s, 'list', 1, 'us')) // the exact one is a team point too
    expect(rows[1].points).toEqual({ A: 0, B: shown(s, 'finger', SCORING.calledRight) })
  })
  it('always sums to the session total', () => {
    const s = {
      ...withActs(act('A', 0, [[1, 1], [2, 3]])),
      finger: finger(aRight, aRight),
      wave: { rounds: [wRound('A', 0), wRound('B', 90)], current: 1 },
      draw: { rounds: [dRound('A', true), dRound('B', false)], current: 1 },
    }
    const total = gameScores(s).reduce(
      (t, g) => ({ A: t.A + g.points.A, B: t.B + g.points.B }),
      { A: 0, B: 0 },
    )
    expect(total).toEqual(standing(s))
  })
})

describe('drawAward', () => {
  it('pays the guesser for reading the drawing, and nothing for missing it', () => {
    expect(drawAward(dRound('A', true))).toEqual({ player: 'B', points: SCORING.drawCorrect })
    expect(drawAward(dRound('A', false))).toBe(null)
    expect(drawAward(dRound('A', null))).toBe(null)
  })
})
