import { describe, it, expect } from 'vitest'
import { DAILY_KINDS, kindOfTheDay } from './rotation'
import { localDate } from './dates'

describe('kindOfTheDay', () => {
  it('walks all five kinds on five days running, then starts over', () => {
    const start = new Date(2026, 9, 1)
    const week = Array.from({ length: 6 }, (_, i) => kindOfTheDay(localDate(i, start)))
    expect(new Set(week.slice(0, 5))).toEqual(new Set(DAILY_KINDS))
    expect(week[5]).toBe(week[0])
  })
  it('turns over across a month end like any other day', () => {
    const end = new Date(2026, 0, 31)
    expect(kindOfTheDay(localDate(1, end))).not.toBe(kindOfTheDay(localDate(0, end)))
  })
})
