import { useCallback, useEffect, useRef } from 'react'
import { setLive, type Live } from '../net'

// Sends the live preview (see net/live.ts) at most every ~120ms while a finger drags or
// thumbs type, always ending on the latest value — smooth enough to watch, light on the wire.
export function useLiveSender(key: string): (value: Live['value']) => void {
  const last = useRef(0)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current) }, [])
  return useCallback((value: Live['value']) => {
    const send = () => {
      last.current = Date.now()
      pending.current = null
      setLive({ key, value })
    }
    if (pending.current) clearTimeout(pending.current)
    const wait = 120 - (Date.now() - last.current)
    if (wait <= 0) send()
    else pending.current = setTimeout(send, wait)
  }, [key])
}
