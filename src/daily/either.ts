import { makeRng, shuffled } from '../engine/rng'
import { dayIndex } from './dates'

export const EITHER_COUNT = 5

// The day's five pairs — the same five on both phones, a fresh shuffle each day (see
// numbersOfTheDay for why not a fixed walk).
export function eitherOfTheDay(date: string, pool: string[]): string[] | null {
  if (pool.length < EITHER_COUNT) return null
  return shuffled(makeRng(0x3e1 ^ dayIndex(date)), pool).slice(0, EITHER_COUNT)
}

// "Tea | Coffee" → ['Tea', 'Coffee'].
export function sides(pair: string): [string, string] {
  const [a = '', b = ''] = pair.split('|').map((x) => x.trim())
  return [a, b]
}

// How well you read them, out of five.
export function eitherSummary(matches: number): string {
  if (matches === 5) return 'All five — you know them'
  if (matches === 4) return 'Four out of five'
  if (matches === 3) return 'Three out of five'
  if (matches === 2) return 'Two out of five'
  if (matches === 1) return 'Just the one'
  return 'None — who are they?'
}
