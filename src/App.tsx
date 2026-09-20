import { useEffect, useRef, useState } from 'react'
import { initNet, getIsStreamScreen } from './net'
import { resolveMode, resolveGame, stampMode, type PlayMode, type Game } from './start/mode'
import { ModePicker } from './start/ModePicker'
import { GamePicker } from './start/GamePicker'
import { Screen } from './screen/Screen'
import { Play } from './play/Play'
import { Duo } from './duo/Duo'

export default function App() {
  // Mode and game both come from the URL (a shared link carries both) or the two launch
  // pickers in sequence — how you're playing, then what you're playing.
  const [mode, setMode] = useState<PlayMode | null>(() => resolveMode(window.location.search))
  const [game, setGame] = useState<Game | null>(() => resolveGame(window.location.search))
  const pendingBot = useRef(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (mode && game) initNet(mode, game).then(() => setReady(true))
  }, [mode, game])

  if (!mode) {
    return <ModePicker onPick={(m, bot) => { pendingBot.current = !!bot; setMode(m) }} />
  }
  if (!game) {
    // stampMode writes ?mode and ?game into the URL BEFORE initNet, so Playroom's share
    // link (location.href + #r=CODE) carries both to the joining device.
    return <GamePicker onPick={(g) => { stampMode(mode, g, pendingBot.current); setGame(g) }} />
  }
  if (!ready) return <Connecting />
  if (mode === 'screen') return getIsStreamScreen() ? <Screen /> : <Play />
  // Duo and solo share a layout: the board on top, your own controller underneath.
  return <Duo />
}

function Connecting() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="text-lg uppercase tracking-[0.3em] text-fg/40 animate-pulse">Connecting…</div>
    </div>
  )
}
