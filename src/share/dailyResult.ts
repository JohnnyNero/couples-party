import { useEffect } from 'react'
import type { SessionState } from '../engine/state'
import { nextGame, gameOfPhase } from '../engine/roster'
import { summarise, type CardData } from './card'

// Today's daily challenge, once played: kept on this phone, so Today can say you've done
// it (it's once a day) and still share it later.
const key = (day: number) => `coupled:daily:${day}`

export function loadDaily(day: number): CardData | null {
  try {
    const raw = localStorage.getItem(key(day))
    return raw ? (JSON.parse(raw) as CardData) : null
  } catch {
    return null
  }
}

// Kept the moment the result is in — the last game's scoreboard — in case nobody taps
// Finish after it.
export function useRecordDaily(s: SessionState, enabled: boolean): void {
  const current = gameOfPhase(s.phase)
  const over = s.phase === 'DONE' || (s.phase.endsWith('_RESULT') && !!current && nextGame(s, current) === null)
  useEffect(() => {
    if (!enabled || s.game !== 'daily' || !over) return
    try { localStorage.setItem(key(s.night), JSON.stringify(summarise(s))) } catch { /* not kept */ }
  }, [enabled, over, s])
}
