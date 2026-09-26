import { useState } from 'react'

// Little buzzes, on phones that can (Android — iPhones don't let a web page vibrate):
// locking an answer in, the last few seconds of a clock, and every celebration. Short
// and rare, so they mean something. Switched off in Profile → Settings.

export type Buzz = 'tap' | 'lock' | 'tick' | 'hit' | 'stamp' | 'win'

const PATTERNS: Record<Buzz, number | number[]> = {
  tap: 8, // a button that moves things on
  lock: 18, // your answer's in
  tick: 10, // a second going, near the end
  hit: [18, 60, 26], // a match, a bullseye, points
  stamp: [40], // PERFECT coming down
  win: [30, 70, 30, 70, 60], // the big ones
}

const KEY = 'coupled:haptics'
let enabled = (() => {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
})()

export const canBuzz = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

export function buzz(kind: Buzz): void {
  if (!enabled || !canBuzz()) return
  try { navigator.vibrate(PATTERNS[kind]) } catch { /* not allowed yet — no tap on the page so far */ }
}

// …after a delay, to land with an animation rather than before it.
export function buzzAt(kind: Buzz, delayMs: number): () => void {
  if (delayMs <= 0) {
    buzz(kind)
    return () => {}
  }
  const id = setTimeout(() => buzz(kind), delayMs)
  return () => clearTimeout(id)
}

export function useHaptics(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(enabled)
  const set = (v: boolean) => {
    enabled = v
    setOn(v)
    try { localStorage.setItem(KEY, v ? 'on' : 'off') } catch { /* not kept */ }
    if (v) buzz('hit') // so you feel what you've switched on
  }
  return [on, set]
}
