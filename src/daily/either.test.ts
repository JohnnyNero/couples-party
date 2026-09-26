import { describe, expect, it } from 'vitest'
import { eitherOfTheDay, sides } from './either'

describe('this or that', () => {
  const pool = Array.from({ length: 20 }, (_, i) => `A${i} | B${i}`)
  it('picks the same five for a date, different ones the next day', () => {
    expect(eitherOfTheDay('2026-09-26', pool)).toEqual(eitherOfTheDay('2026-09-26', pool))
    expect(eitherOfTheDay('2026-09-26', pool)).toHaveLength(5)
    expect(eitherOfTheDay('2026-09-27', pool)).not.toEqual(eitherOfTheDay('2026-09-26', pool))
    expect(eitherOfTheDay('2026-09-26', pool.slice(0, 4))).toBeNull()
  })
  it('splits a pair', () => {
    expect(sides('Tea | Coffee')).toEqual(['Tea', 'Coffee'])
  })
})
