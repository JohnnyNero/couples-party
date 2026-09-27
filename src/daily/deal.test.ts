import { describe, expect, it } from 'vitest'
import { cooldownDays, dealPick, walkPick } from './deal'
import { localDate } from './dates'

const pool = (n: number) => Array.from({ length: n }, (_, i) => `q${i}`)
const days = (from: string, n: number) => {
  const [y, m, d] = from.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => localDate(i, new Date(y, m - 1, d)))
}
const id = (t: string) => t

describe('dealing five a day', () => {
  it('never brings one back within two-thirds of the way round the pool', () => {
    for (const n of [30, 42, 62, 90]) {
      const last = new Map<string, number>()
      let closest = Infinity
      days('2026-01-01', 400).forEach((date, day) => {
        const hand = dealPick(date, pool(n), 5, 0x2b7, id)!
        expect(new Set(hand).size).toBe(5) // five different ones
        for (const q of hand) {
          if (last.has(q)) closest = Math.min(closest, day - last.get(q)!)
          last.set(q, day)
        }
      })
      expect(closest).toBeGreaterThanOrEqual(Math.floor(((2 / 3) * n) / 5) - 1)
    }
  })

  it('is the same five on both phones, and not the same five every time round', () => {
    expect(dealPick('2026-09-27', pool(42), 5, 1, id)).toEqual(dealPick('2026-09-27', pool(42), 5, 1, id))
    const first = dealPick('2026-09-27', pool(40), 5, 1, id)!.sort()
    const nextRound = dealPick('2026-10-05', pool(40), 5, 1, id)!.sort() // 8 days: once round the pool
    expect(nextRound).not.toEqual(first)
  })

  it('passes over anything asked recently — the day new content reshuffles everything', () => {
    const recent = new Set(dealPick('2026-09-27', pool(42), 5, 1, id))
    const bigger = [...pool(42), 'new1', 'new2', 'new3']
    const next = dealPick('2026-09-28', bigger, 5, 1, id, recent)!
    expect(next.filter((q) => recent.has(q))).toEqual([])
  })

  it('still deals five when nearly everything is recent', () => {
    expect(dealPick('2026-09-27', pool(6), 5, 1, id, new Set(pool(5)))).toHaveLength(5)
  })
})

describe('one a day', () => {
  it('walks the pool as before, passing over the recent', () => {
    const p = pool(20)
    const today = walkPick('2026-09-27', p, 7, id)!
    const tomorrow = walkPick('2026-09-28', p, 7, id)!
    expect(walkPick('2026-09-27', p, 7, id, new Set([today]))).toBe(tomorrow)
  })
  it('looks back most of the way round the pool, at most two months', () => {
    expect(cooldownDays(42, 5)).toBe(5)
    expect(cooldownDays(90, 5)).toBe(10)
    expect(cooldownDays(37, 1)).toBe(22)
    expect(cooldownDays(1000, 1)).toBe(60)
  })
})
