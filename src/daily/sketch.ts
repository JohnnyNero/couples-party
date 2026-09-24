import { makeRng, shuffled } from '../engine/rng'
import type { DrawPrompt, DrawStroke } from '../engine/state'
import { dayIndex } from './dates'

export const SKETCH_GUESSES = 3

// The day's Sketch question — same idea as questionOfTheDay and dialOfTheDay, walking
// Draw Your Answer's own pool in one fixed shuffled order, on its own seed.
export function sketchOfTheDay(date: string, pool: DrawPrompt[]): string | null {
  if (pool.length === 0) return null
  const order = shuffled(makeRng(0x5e7c4), pool)
  const day = dayIndex(date)
  return order[((day % order.length) + order.length) % order.length].text
}

// Three decimal places is finer than any finger, and keeps a busy drawing well under
// the server's size limit.
export function compactStrokes(strokes: DrawStroke[]): DrawStroke[] {
  const r = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000
  return strokes.filter((s) => s.length > 0).map((s) => s.map(([x, y]) => [r(x), r(y)] as [number, number]))
}
