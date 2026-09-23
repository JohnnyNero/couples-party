import { makeRng, shuffled } from '../engine/rng'
import type { Theme } from '../engine/state'
import { dayIndex } from './dates'

export const TOP5_SIZE = 5

// Which Shortlist theme today — same idea as questionOfTheDay and dialOfTheDay, walked
// in one fixed shuffled order so nothing repeats until every theme has had its day.
// Every shipped theme has well over five items (content.test.ts holds it to 7+), but
// this stays honest if that ever changes.
export function themeOfTheDay(date: string, themes: Theme[]): Theme | null {
  const eligible = themes.filter((t) => t.pool.length >= TOP5_SIZE)
  if (eligible.length === 0) return null
  const day = dayIndex(date)
  const order = shuffled(makeRng(0x70075), eligible)
  return order[((day % order.length) + order.length) % order.length]
}

// Five of that theme's pool, in the fixed order they're offered up to rank — a second,
// independent shuffle so which five (and their order) doesn't just track the theme's
// own place in its rotation. Both of you see this same five, in this same order.
export function itemsOfTheDay(date: string, theme: Theme): string[] {
  const order = shuffled(makeRng(0x17e5 ^ dayIndex(date)), theme.pool)
  return order.slice(0, TOP5_SIZE)
}

// "seven things {name}…" reads oddly when only five of them are here to rank.
export function fiveify(themeText: string): string {
  return themeText.replace(/^seven /i, 'five ')
}
