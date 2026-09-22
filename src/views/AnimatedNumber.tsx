import { useEffect, useRef, useState } from 'react'

// Ticks up to a new value instead of just popping to it — used on the handful of
// screens where a number is the payoff (a score, a displacement). These screens
// remount fresh each round (see phaseKey), so the tween always starts from `from`
// (0 by default) on mount, then from whatever it last showed if the value changes
// again while still mounted.
export function AnimatedNumber({
  value,
  from = 0,
  durationMs = 600,
  delayMs = 0,
}: {
  value: number
  from?: number
  durationMs?: number
  delayMs?: number
}) {
  const [display, setDisplay] = useState(from)
  const shown = useRef<number | null>(null)

  useEffect(() => {
    const start = shown.current ?? from
    if (start === value) {
      setDisplay(value)
      shown.current = value
      return
    }
    // A delay lets the number wait for whatever is revealing above it, rather than
    // counting up past a value the screen hasn't shown yet.
    const startedAt = performance.now() + delayMs
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - startedAt) / durationMs))
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplay(Math.round(start + (value - start) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
      else shown.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `from`/`durationMs`/`delayMs` are fixed per call site
  }, [value])

  return <>{display}</>
}
