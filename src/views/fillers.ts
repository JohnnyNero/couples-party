import type { ClockGame, SessionState } from '../engine/state'

// Stop the Clock runs twice over: as a filler (s.clock) and as a level night's
// tiebreaker (s.decider). The screens are shared; this says which one is live.
export function liveClock(s: SessionState): { game: ClockGame; decider: boolean } | null {
  if (s.phase.startsWith('DECIDER_') && s.decider) return { game: s.decider, decider: true }
  if (s.phase.startsWith('CLOCK_') && s.clock) return { game: s.clock, decider: false }
  return null
}

export const seconds = (ms: number, places = 2) => `${(ms / 1000).toFixed(places)} s`

export function hideHint(hideAfterMs: number): string {
  if (hideAfterMs <= 0) return "You won't see the clock at all"
  const secs = hideAfterMs / 1000
  return `The clock hides after ${secs} second${secs === 1 ? '' : 's'}`
}
