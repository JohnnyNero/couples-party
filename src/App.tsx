import { useEffect, useState } from 'react'
import { initNet, useIsStreamScreen } from './net/playroom'
import { Screen } from './screen/Screen'
import { Play } from './play/Play'

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => { initNet().then(() => setReady(true)) }, [])
  if (!ready) return <div className="p-8 font-board text-2xl">connecting…</div>
  return useIsStreamScreen() ? <Screen /> : <Play />
}
