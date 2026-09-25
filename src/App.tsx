import { useEffect, useState } from 'react'
import { initNet, getIsStreamScreen, useSession } from './net'
import { recordSeen } from './store/seen'
import { useKeepMemory } from './memories/useKeepMemory'
import { api } from './daily/api'
import { resolveMode, resolveGame, stampMode, type PlayMode, type Game } from './start/mode'
import { ModePicker } from './start/ModePicker'
import { Home } from './start/Home'
import { Screen } from './screen/Screen'
import { Play } from './play/Play'
import { Duo } from './duo/Duo'
import { FullscreenToggle } from './views/FullscreenToggle'

export default function App() {
  // Game and mode both come from the URL (a shared link carries both) or the launch
  // screens in sequence — what you're playing (the home screen), then how.
  const [mode, setMode] = useState<PlayMode | null>(() => resolveMode(window.location.search))
  const [game, setGame] = useState<Game | null>(() => resolveGame(window.location.search))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!mode || !game) return
    // Paired phones skip Playroom's own room-code lobby and join straight into their
    // couple's own room — but only for the ordinary two-phones case, and only when
    // this load isn't itself a shared link (Playroom's own share link carries the
    // room to join as "#r=CODE" in the hash, and that must win). A failed lookup
    // never holds the game up — it just falls back to Playroom's usual lobby.
    const sharedLink = /(?:^|[#&])r=/.test(window.location.hash)
    const wantsCode = mode === 'duo' && !sharedLink
    ;(wantsCode ? api.coupleCode().catch(() => null) : Promise.resolve(null)).then((code) => {
      initNet(mode, game, code ?? undefined).then(() => setReady(true))
    })
  }, [mode, game])

  return (
    <>
      <FullscreenToggle />
      {ready && <SeenRecorder keep={mode !== 'solo' && !getIsStreamScreen()} />}
      {renderApp()}
    </>
  )

  function renderApp() {
    if (!game) return <Home onPick={setGame} />
    if (!mode) {
      return (
        <ModePicker
          game={game}
          onBack={() => setGame(null)}
          onPick={(m, bot) => {
            // stampMode writes ?mode and ?game into the URL BEFORE initNet, so Playroom's
            // share link (location.href + #r=CODE) carries both to the joining device.
            stampMode(m, game, !!bot)
            setMode(m)
          }}
        />
      )
    }
    if (!ready) return <Connecting />
    if (mode === 'screen') return getIsStreamScreen() ? <Screen /> : <Play />
    // Duo and solo share a layout: the board on top, your own controller underneath.
    return <Duo />
  }
}

// Logs every prompt the session puts in front of you, so the next one draws new ones —
// and, on a paired phone, keeps the session for Memories. A TV isn't anyone's phone and
// solo play is a testing seat, so neither keeps anything.
function SeenRecorder({ keep }: { keep: boolean }) {
  const session = useSession()
  useEffect(() => recordSeen(session), [session])
  useKeepMemory(session, keep)
  return null
}

function Connecting() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
      <div className="flex gap-2">
        <span className="w-3 h-3 rounded-full bg-pa animate-pulse" />
        <span className="w-3 h-3 rounded-full bg-pb animate-pulse [animation-delay:200ms]" />
      </div>
      <div className="font-display text-xl font-bold text-fg/50">Getting the room ready…</div>
    </div>
  )
}
