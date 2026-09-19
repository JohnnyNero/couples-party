import { useEffect, useState } from 'react'

export function Clock({ phaseEndsAt }: { phaseEndsAt: number | null }) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (phaseEndsAt == null) return
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [phaseEndsAt])
  if (phaseEndsAt == null) return <div className="text-4xl tabular-nums">&nbsp;</div>
  const secs = Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000))
  return <div className="text-4xl tabular-nums">{secs}</div>
}
