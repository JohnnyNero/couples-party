import { useEffect, useRef } from 'react'
import type { Game, PlayerId, SessionState } from '../engine/state'
import type { PlayMode } from '../start/mode'

// The game you're in the middle of, kept on this phone — so if you both leave (or the
// room goes), you can pick it back up later from Home, right where you were. Both phones
// keep their own copy, and whichever of you comes back first brings it.
//
// One at a time: starting another game replaces it, and finishing clears it.

export type Saved = {
  v: 1
  game: Game
  mode: PlayMode
  seat: PlayerId // which of the two you were, so the scores stay with the right person
  savedAt: number
  state: SessionState
}

const KEY = 'coupled:in-progress'
const KEEP_MS = 7 * 24 * 60 * 60 * 1000 // a week, then it's forgotten

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    if (saved.v !== 1 || Date.now() - saved.savedAt > KEEP_MS || saved.state.phase === 'DONE') return null
    return saved
  } catch {
    return null
  }
}

export function clearSaved(): void {
  try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
}

function write(saved: Saved): void {
  try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch { /* full or private: just not kept */ }
}

// Worth keeping: a game that's under way (not the lobby) and not over.
export const inProgress = (s: SessionState) => s.phase !== 'JOIN' && s.phase !== 'BOOT' && s.phase !== 'DONE'

// Keeps this phone's copy up to date while you play: a couple of seconds after things
// settle, and straight away if the app is being closed or put away.
export function useKeepProgress(s: SessionState, seat: PlayerId | null, mode: PlayMode, enabled: boolean): void {
  const latest = useRef<Saved | null>(null)
  latest.current = enabled && seat && inProgress(s)
    ? { v: 1, game: s.game, mode, seat, savedAt: Date.now(), state: s }
    : null

  useEffect(() => {
    if (!enabled) return
    if (s.phase === 'DONE') { clearSaved(); return }
    if (!latest.current) return
    const id = setTimeout(() => { if (latest.current) write({ ...latest.current, savedAt: Date.now() }) }, 1500)
    return () => clearTimeout(id)
  }, [s, enabled])

  useEffect(() => {
    if (!enabled) return
    const now = () => { if (latest.current) write({ ...latest.current, savedAt: Date.now() }) }
    const hidden = () => { if (document.visibilityState === 'hidden') now() }
    window.addEventListener('pagehide', now)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', now)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [enabled])
}
