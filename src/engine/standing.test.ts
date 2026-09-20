import { describe, it, expect } from 'vitest'
import { initialState, type ListAct, type PlayerId } from './state'
import { listAward, standing, leader } from './standing'

const act = (author: PlayerId, displacement: number | null): ListAct => ({
  author, themeId: 't001', pool: [], items: [], swapDone: true, displacement,
})

const withActs = (...acts: ListAct[]) => ({ ...initialState(1), listActs: acts })

describe('listAward', () => {
  it('awards the author 3 for a perfect read', () => {
    expect(listAward(act('A', 0))).toEqual({ player: 'A', points: 3 })
  })
  it('awards the author 1 across 1–4', () => {
    expect(listAward(act('A', 1))).toEqual({ player: 'A', points: 1 })
    expect(listAward(act('A', 4))).toEqual({ player: 'A', points: 1 })
  })
  it('moves nothing across 5–12', () => {
    expect(listAward(act('A', 5))).toBe(null)
    expect(listAward(act('A', 12))).toBe(null)
  })
  it('awards the ranker 1 from 13 up', () => {
    expect(listAward(act('A', 13))).toEqual({ player: 'B', points: 1 })
    expect(listAward(act('B', 24))).toEqual({ player: 'A', points: 1 })
  })
  it('awards nothing for an unresolved act', () => {
    expect(listAward(act('A', null))).toBe(null)
  })
})

describe('standing', () => {
  it('is zero-zero before anything resolves', () => {
    expect(standing(initialState(1))).toEqual({ A: 0, B: 0 })
    expect(leader(initialState(1))).toBe(null)
  })
  it('sums both runs of the act', () => {
    const s = withActs(act('A', 0), act('B', 13))
    expect(standing(s)).toEqual({ A: 4, B: 0 })
    expect(leader(s)).toBe('A')
  })
  it('reports level as null', () => {
    expect(leader(withActs(act('A', 2), act('B', 3)))).toBe(null)
  })
})
