import { dealPick } from './deal'

export const EITHER_COUNT = 5

// The day's five pairs — the same five on both phones, dealt like Their Numbers' (see
// deal.ts), passing over any in `recent`.
export function eitherOfTheDay(date: string, pool: string[], recent?: Set<string>): string[] | null {
  return dealPick(date, pool, EITHER_COUNT, 0x3e1, (t) => t, recent)
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
