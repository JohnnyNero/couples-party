import { useEffect } from 'react'
import type { SessionState } from '../engine/state'
import { nextGame, gameOfPhase } from '../engine/roster'
import { summarise, type CardData } from './card'

// Tonight is the same for every couple each day, and numbered, so it can be compared.
// The first time you finish it that day is "Tonight #N"; play it again and it's a
// replay — still yours to enjoy and share, marked as a replay. The first one is kept on
// this phone, so Today can show it and share it later.
const key = (day: number) => `coupled:tonight:${day}`

// This page load is the one that finished the day's first go (a game is a page load).
let firstHere = false

export function loadTonight(day: number): CardData | null {
  try {
    const raw = localStorage.getItem(key(day))
    return raw ? (JSON.parse(raw) as CardData) : null
  } catch {
    return null
  }
}

export const isReplay = (s: SessionState): boolean => s.game === 'tonight' && !firstHere && loadTonight(s.night) !== null

// The session's over once its last game's scoreboard is up — kept then, in case nobody
// taps on to Lights Out.
function finished(s: SessionState): boolean {
  if (s.phase === 'DONE' || s.phase === 'LIGHTS_OUT') return true
  const current = gameOfPhase(s.phase)
  if (!s.phase.endsWith('_RESULT') || !current) return false
  const next = nextGame(s, current)
  return next === null || next === 'lights'
}

export function useRecordTonight(s: SessionState, enabled: boolean): void {
  const over = finished(s)
  useEffect(() => {
    if (!enabled || s.game !== 'tonight' || !over) return
    if (!firstHere && loadTonight(s.night)) return // a replay: the first go stands
    firstHere = true
    try { localStorage.setItem(key(s.night), JSON.stringify(summarise(s))) } catch { /* not kept */ }
  }, [enabled, over, s])
}
