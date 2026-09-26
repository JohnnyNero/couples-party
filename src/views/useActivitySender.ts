import { useEffect, useRef } from 'react'
import { setActivity, type ActivityKind } from '../net'

// Tells your partner what you're up to, from wherever you're doing it — one listener for
// the whole game rather than every screen wiring it in. Typing into any box is "typing";
// a drag on anything marked `data-activity` (the drawing pad says "drawing", the dial
// "deciding") is that. Two seconds of nothing, or the game moving on, clears it.
// Only a change is sent, so a burst of typing is one message, not one per key.
const IDLE_MS = 2000

export function useActivitySender(screen: string): void {
  const current = useRef<ActivityKind | null>(null)
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const screenRef = useRef(screen)
  screenRef.current = screen

  useEffect(() => {
    const clear = () => {
      if (idle.current) clearTimeout(idle.current)
      idle.current = null
      if (current.current !== null) {
        current.current = null
        setActivity(null)
      }
    }
    const note = (kind: ActivityKind) => {
      if (current.current !== kind) {
        current.current = kind
        setActivity({ kind, key: screenRef.current })
      }
      if (idle.current) clearTimeout(idle.current)
      idle.current = setTimeout(clear, IDLE_MS)
    }
    const onInput = (e: Event) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) note('typing')
    }
    const onPointer = (e: PointerEvent) => {
      if (e.type === 'pointermove' && !e.buttons) return
      const marked = (e.target as HTMLElement | null)?.closest?.('[data-activity]')
      const kind = marked?.getAttribute('data-activity') as ActivityKind | null
      if (kind) note(kind)
    }
    document.addEventListener('input', onInput, true)
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('pointermove', onPointer, true)
    return () => {
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('pointermove', onPointer, true)
      clear()
    }
  }, [])

  // A new screen: whatever you were doing on the last one is done.
  useEffect(() => {
    if (idle.current) clearTimeout(idle.current)
    idle.current = null
    if (current.current !== null) {
      current.current = null
      setActivity(null)
    }
  }, [screen])
}
