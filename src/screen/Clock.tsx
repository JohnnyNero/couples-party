import { useEffect, useState } from 'react'

// Renders the countdown from the broadcast absolute deadline. Never receives a
// decrementing number over the wire — it derives seconds from phaseEndsAt locally.
// Sizing/colour context is owned by the parent; this only turns accent in the last
// few seconds.
export function Clock({ phaseEndsAt }: { phaseEndsAt: number | null }) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (phaseEndsAt == null) return
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [phaseEndsAt])

  const secs = phaseEndsAt == null ? null : Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000))
  const low = secs !== null && secs <= 5
  return <span className={'tabular-nums font-bold ' + (low ? 'text-pa-ink' : '')}>{secs === null ? ' ' : secs}</span>
}
