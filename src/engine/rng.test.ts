import { describe, it, expect } from 'vitest'
import { makeRng, pick, shuffled } from './rng'

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42); const b = makeRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('produces values in [0,1)', () => {
    const r = makeRng(7)
    for (let i = 0; i < 100; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
  it('pick returns a member of the array', () => {
    const r = makeRng(1)
    const arr = ['x', 'y', 'z']
    expect(arr).toContain(pick(r, arr))
  })
})

describe('shuffled', () => {
  it('is a permutation and does not mutate the input', () => {
    const src = [1, 2, 3, 4, 5, 6, 7]
    const out = shuffled(makeRng(9), src)
    expect(out).toHaveLength(7)
    expect([...out].sort()).toEqual(src)
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it('is deterministic for a given seed', () => {
    expect(shuffled(makeRng(42), 'abcdefg'.split(''))).toEqual(shuffled(makeRng(42), 'abcdefg'.split('')))
  })
})
