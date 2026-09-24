import { useCallback, useEffect, useRef, useState } from 'react'
import { api, DailyError, type Daily, type DailyDial, type DailySketch, type DailyTop5 } from './api'
import { localDate } from './dates'

export type DailyStatus<T> =
  | { kind: 'loading' }
  | { kind: 'error'; error: DailyError }
  | { kind: 'ready'; data: T }

// A card's view of the server, whatever it's showing — Today, The Dial, or any daily
// puzzle that follows the same shape. Re-reads when the app comes back to the
// foreground (your partner may have set or solved something while it was closed), and
// polls while unpaired: while you're waiting for them to type the code in, but also
// while you're single — pairing itself only runs on one card, so every OTHER card's own
// hook has no other way to notice it just happened.
function useDailyOf<T extends { state: string }>(fetch: () => Promise<T>) {
  const [status, setStatus] = useState<DailyStatus<T>>({ kind: 'loading' })
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const data = await fetch()
      if (alive.current) setStatus({ kind: 'ready', data })
    } catch (e) {
      const error = e instanceof DailyError ? e : new DailyError("Couldn't reach the server.", 'offline')
      if (alive.current) setStatus({ kind: 'error', error })
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive.current = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const unpaired = status.kind === 'ready' && (status.data.state === 'waiting' || status.data.state === 'single')
  useEffect(() => {
    if (!unpaired) return
    const id = setInterval(() => void refresh(), 4000)
    return () => clearInterval(id)
  }, [unpaired, refresh])

  return { status, refresh }
}

export function useDaily() {
  return useDailyOf<Daily>(() => api.daily(localDate()))
}

export function useDailyDial() {
  return useDailyOf<DailyDial>(() => api.dailyDial(localDate()))
}

export function useDailyTop5() {
  return useDailyOf<DailyTop5>(() => api.dailyTop5(localDate()))
}

export function useDailySketch() {
  return useDailyOf<DailySketch>(() => api.dailySketch(localDate()))
}
