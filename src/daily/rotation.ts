import { dayIndex } from './dates'

// One daily puzzle a day, walking all five kinds in turn — the same on both phones,
// because it's worked out from the date, the same way each puzzle picks its question.
export const DAILY_KINDS = ['word', 'dial', 'top5', 'sketch', 'numbers'] as const
export type DailyKind = (typeof DAILY_KINDS)[number]

export function kindOfTheDay(date: string): DailyKind {
  const n = DAILY_KINDS.length
  return DAILY_KINDS[((dayIndex(date) % n) + n) % n]
}
