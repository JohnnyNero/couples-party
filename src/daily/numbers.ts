import { makeRng, shuffled } from '../engine/rng'
import { dayIndex } from './dates'

export const NUMBERS_COUNT = 5

// The day's five questions — the same five on both phones. A fresh shuffle each day
// rather than walking a fixed order: five from a pool of about thirty would otherwise
// march through in lockstep, the same neighbours always turning up together.
export function numbersOfTheDay(date: string, pool: string[]): string[] | null {
  if (pool.length < NUMBERS_COUNT) return null
  return shuffled(makeRng(0x2b7 ^ dayIndex(date)), pool).slice(0, NUMBERS_COUNT)
}
