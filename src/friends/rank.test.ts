import { describe, it, expect } from 'vitest'
import { rankRows } from './rank'

const pts = (...points: number[]) => points.map((p) => ({ points: p }))

describe('ranking the leaderboard', () => {
  it('numbers rows in order', () => {
    expect(rankRows(pts(50, 30, 10)).map((r) => r.rank)).toEqual([1, 2, 3])
  })
  it('gives a tie the same rank and skips the ones it took', () => {
    expect(rankRows(pts(50, 50, 30, 30, 30, 5)).map((r) => r.rank)).toEqual([1, 1, 3, 3, 3, 6])
  })
  it('ranks everyone level, even at 0, first together', () => {
    expect(rankRows(pts(0, 0, 0)).map((r) => r.rank)).toEqual([1, 1, 1])
  })
  it('keeps the rest of each row, and copes with nothing', () => {
    expect(rankRows([{ points: 7, id: 'x' }])).toEqual([{ points: 7, id: 'x', rank: 1 }])
    expect(rankRows([])).toEqual([])
  })
})
