import { dayIndex } from '../daily/dates'

// The daily challenge's number: #1 on the day it started, counting up one a day — the
// same number for every couple, so "did you do #12?" means the same thing to everyone.
const FIRST_DAY = dayIndex('2026-09-27')

export const dailyNumber = (day: number): number => day - FIRST_DAY + 1

// Every couple's daily challenge is dealt from the same seed, so it's the same set —
// the same prompts, the same targets — wherever it's played that day.
export const dailySeed = (day: number): number => ((day * 2654435761) >>> 0) % 1_000_000_000
