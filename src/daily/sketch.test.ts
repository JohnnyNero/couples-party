import { describe, it, expect } from 'vitest'
import { compactStrokes, sketchOfTheDay } from './sketch'

describe('sketchOfTheDay', () => {
  const pool = ['comfort food', 'dream job', 'happy place'].map((text, i) => ({ id: `d${i}`, text }))
  it('is the same on both phones, and walks the pool before repeating', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03'].map((d) => sketchOfTheDay(d, pool))
    expect(new Set(days).size).toBe(3)
    expect(sketchOfTheDay('2026-10-04', pool)).toBe(days[0])
  })
  it('has nothing to offer from an empty pool', () => {
    expect(sketchOfTheDay('2026-10-01', [])).toBe(null)
  })
})

describe('compactStrokes', () => {
  it('rounds to three places, clamps to the canvas, and drops empty strokes', () => {
    expect(compactStrokes([[[0.123456, 1.2]], [], [[-0.1, 0.5]]])).toEqual([[[0.123, 1]], [[0, 0.5]]])
  })
})
