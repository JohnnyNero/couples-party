import { describe, it, expect } from 'vitest'
import { numbersOfTheDay } from './numbers'

describe('numbersOfTheDay', () => {
  const pool = Array.from({ length: 20 }, (_, i) => `q${i}`)
  it('gives five different questions, the same on both phones', () => {
    const a = numbersOfTheDay('2026-10-01', pool)!
    expect(a).toHaveLength(5)
    expect(new Set(a).size).toBe(5)
    expect(numbersOfTheDay('2026-10-01', [...pool])).toEqual(a)
    expect(numbersOfTheDay('2026-10-02', pool)).not.toEqual(a)
  })
  it('has nothing to offer from a pool smaller than five', () => {
    expect(numbersOfTheDay('2026-10-01', pool.slice(0, 4))).toBe(null)
  })
})
