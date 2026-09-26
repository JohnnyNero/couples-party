import { useEffect } from 'react'

// Keeps the screen on while a game is going. It matters beyond not having to tap your
// phone awake: one of the two phones is running the game for both of you, and a phone
// that's gone to sleep can't — the other one's taps just wait until it wakes (that was
// Describe It's "Got it" landing three at once). Released when the game's closed, and
// asked for again when you come back to it (the browser drops it whenever the page is
// hidden). Where the browser can't, nothing changes.
type Sentinel = { release: () => Promise<void> }

export function useWakeLock(on = true): void {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } }
    if (!on || !nav.wakeLock) return
    let lock: Sentinel | null = null
    let live = true
    const take = () => {
      if (document.visibilityState !== 'visible') return
      nav.wakeLock!.request('screen').then((l) => { if (live) lock = l; else void l.release() }).catch(() => {})
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', take)
      void lock?.release().catch(() => {})
    }
  }, [on])
}
