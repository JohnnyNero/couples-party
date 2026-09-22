import { useEffect, useRef, useState } from 'react'
import { FINGER } from '../engine/phases'
import { Dot } from './Dot'

// A hand of dots, one per starting finger — filled is still up, hollow is down.
// Whichever finger just went down gets a little fold animation on the way.
export function Hand({ fingers }: { fingers: number }) {
  const was = useRef(fingers)
  const [justDown, setJustDown] = useState<number | null>(null)

  useEffect(() => {
    if (fingers < was.current) {
      setJustDown(fingers) // the newly-hollow dot sits at this index
      const t = setTimeout(() => setJustDown(null), 420)
      was.current = fingers
      return () => clearTimeout(t)
    }
    was.current = fingers
  }, [fingers])

  return (
    <div className="flex gap-1 justify-center">
      {Array.from({ length: FINGER.startFingers }, (_, i) => (
        <span key={i} className={'inline-block' + (i === justDown ? ' animate-finger-fold' : '')}>
          <Dot on={i < fingers} />
        </span>
      ))}
    </div>
  )
}
