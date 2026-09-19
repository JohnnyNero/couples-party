import { describe, it, expect } from 'vitest'
import { makeRng, pick } from './rng'

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
