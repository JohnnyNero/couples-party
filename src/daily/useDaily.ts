import { useCallback, useEffect, useRef, useState } from 'react'
import { api, DailyError, type Daily } from './api'
import { localDate } from './dates'

export type DailyStatus =
  | { kind: 'loading' }
  | { kind: 'error'; error: DailyError }
  | { kind: 'ready'; data: Daily }

// The Today tab's view of the server. It re-reads when the app comes back to the
// foreground (your partner may have set or solved something while it was closed), and
// polls while you're waiting for them to type the pairing code in.
export function useDaily() {
  const [status, setStatus] = useState<DailyStatus>({ kind: 'loading' })
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api.daily(localDate())
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

  const waiting = status.kind === 'ready' && status.data.state === 'waiting'
  useEffect(() => {
    if (!waiting) return
    const id = setInterval(() => void refresh(), 4000)
    return () => clearInterval(id)
  }, [waiting, refresh])

  return { status, refresh }
}
