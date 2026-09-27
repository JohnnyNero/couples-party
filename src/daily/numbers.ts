import { dealPick } from './deal'

export const NUMBERS_COUNT = 5

// The day's five questions — the same five on both phones, dealt so none comes back
// soon after it last did (see deal.ts), passing over any in `recent`.
export function numbersOfTheDay(date: string, pool: string[], recent?: Set<string>): string[] | null {
  return dealPick(date, pool, NUMBERS_COUNT, 0x2b7, (t) => t, recent)
}
