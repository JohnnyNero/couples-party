import { makeRng, shuffled } from '../engine/rng'
import type { WaveSpectrum } from '../engine/state'
import { dayIndex } from './dates'

// The day's spectrum for The Dial — same idea as questionOfTheDay, walking Wavelength's
// own spectrum pool in one fixed shuffled order so nothing repeats until they all have.
// A different seed from Their Word's, so the two don't happen to pick in lockstep.
export function dialOfTheDay(date: string, pool: WaveSpectrum[]): WaveSpectrum | null {
  if (pool.length === 0) return null
  const day = dayIndex(date)
  const order = shuffled(makeRng(0xd1a1), pool)
  return order[((day % order.length) + order.length) % order.length]
}

// A spectrum stores as "Low | High" in the puzzle's prompt column, the same text a
// player would read either side of the slider.
export const spectrumPrompt = (s: WaveSpectrum): string => `${s.low} | ${s.high}`
export function parseSpectrumPrompt(prompt: string): { low: string; high: string } {
  const [low, high] = prompt.split('|').map((t) => t.trim())
  return { low: low ?? '', high: high ?? '' }
}
