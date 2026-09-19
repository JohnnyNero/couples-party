// Task 1.1: stream screen now routes to the real host renderer. Phone side is still
// the Task 0.4 counter placeholder here; Task 1.2 replaces it with <Play/>.
import { useEffect, useState } from 'react'
import { initNet, useIsStreamScreen, useMyPlayerId } from './net/playroom'
import { Screen } from './screen/Screen'

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    initNet().then(() => setReady(true))
  }, [])

  const isScreen = useIsStreamScreen()
  const me = useMyPlayerId()

  if (!ready) return <div className="p-8 font-board">connecting…</div>

  if (isScreen) {
    return <Screen />
  }

  // Ruling P1: JOIN is automatic (dispatched by the host inside onPlayerJoin), so the
  // phone view has no name entry and no JOIN button — it just reflects assigned identity.
  return (
    <div className="p-8 font-board">
      <div className="text-4xl">PHONE ({me ?? '?'})</div>
    </div>
  )
}
