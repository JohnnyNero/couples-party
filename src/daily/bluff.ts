import { walkPick } from './deal'

// The day's Two Lies prompt — same idea as questionOfTheDay, walking the live game's own
// pool ("[Your|@'s] worst ever present") in one fixed shuffled order, on its own seed.
export function bluffOfTheDay(date: string, pool: string[], recent?: Set<string>): string | null {
  return walkPick(date, pool, 0xb1f, (t) => t, recent)
}

// The truth goes in at a random place among the three, so where it sits gives nothing away.
export function placeTruth(truth: string, lies: [string, string]): { statements: string[]; truth: number } {
  const at = Math.floor(Math.random() * 3)
  const statements = [...lies]
  statements.splice(at, 0, truth)
  return { statements, truth: at }
}
