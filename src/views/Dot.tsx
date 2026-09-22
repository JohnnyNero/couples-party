import { useEffect, useRef, useState } from 'react'

// Submission indicator. Filled accent = submitted; hollow = not yet. Square, not a
// glyph, so it reads cleanly across a room. Never labelled with whose it is beyond
// left/right order — it is public "n of 2 in" truth, not a name.
export function Dot({ on }: { on: boolean }) {
  const was = useRef(on)
  const [justFilled, setJustFilled] = useState(false)

  useEffect(() => {
    if (on && !was.current) {
      setJustFilled(true)
      const t = setTimeout(() => setJustFilled(false), 320)
      was.current = on
      return () => clearTimeout(t)
    }
    was.current = on
  }, [on])

  return (
    <span
      className={
        'inline-block h-4 w-4 sm:h-6 sm:w-6 ' +
        (on ? 'bg-accent' : 'border-2 border-fg/30') +
        (justFilled ? ' animate-pop' : '')
      }
    />
  )
}
