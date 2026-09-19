import { useEffect, useState } from 'react'
import { initNet, getIsStreamScreen } from './net/playroom'
import { resolveMode, stampMode, type PlayMode } from './start/mode'
import { ModePicker } from './start/ModePicker'
import { Screen } from './screen/Screen'
import { Play } from './play/Play'
import { Duo } from './duo/Duo'

export default function App() {
  // Mode comes from the URL (a shared link carries ?mode=…) or the launch picker.
  const [mode, setMode] = useState<PlayMode | null>(() => resolveMode(window.location.search))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (mode) initNet(mode).then(() => setReady(true))
  }, [mode])

  if (!mode) {
    // stampMode writes ?mode into the URL BEFORE initNet, so Playroom's share link
    // (location.href + #r=CODE) carries the mode to the joining device.
    return <ModePicker onPick={(m) => { stampMode(m); setMode(m) }} />
  }
  if (!ready) return <Connecting />
  if (mode === 'screen') return getIsStreamScreen() ? <Screen /> : <Play />
  return <Duo />
}

function Connecting() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="text-lg uppercase tracking-[0.3em] text-fg/40 animate-pulse">Connecting…</div>
    </div>
  )
}
