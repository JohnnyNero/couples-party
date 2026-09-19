// Throwaway transport checkpoint (Task 0.4). Proves the Playroom Stream Mode round-trip:
// a phone connecting flips the screen's connected dot; both connected -> MELD_TYPE.
// Replaced by real game UI in Task 1.x.
import { useEffect, useState } from 'react'
import { initNet, useSession, useIsStreamScreen, useMyPlayerId } from './net/playroom'

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    initNet().then(() => setReady(true))
  }, [])

  const session = useSession()
  const isScreen = useIsStreamScreen()
  const me = useMyPlayerId()

  if (!ready) return <div className="p-8 font-board">connecting…</div>

  if (isScreen) {
    return (
      <div className="p-8 font-board">
        <div className="text-4xl">SCREEN</div>
        <div className="text-2xl mt-4">phase: {session.phase}</div>
        <div className="text-2xl">
          A connected: {String(session.players.A.connected)} · B connected: {String(session.players.B.connected)}
        </div>
      </div>
    )
  }

  // Ruling P1: JOIN is automatic (dispatched by the host inside onPlayerJoin), so the
  // phone view has no name entry and no JOIN button — it just reflects assigned identity.
  return (
    <div className="p-8 font-board">
      <div className="text-4xl">PHONE ({me ?? '?'})</div>
    </div>
  )
}
