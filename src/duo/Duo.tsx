import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useProfile } from '../profile/store'
import { fetchBaseline } from '../memories/baseline'
import type { SessionState } from '../engine/state'
import { useSession, useMyPlayerId } from '../net'
import { screenKey } from '../views/phaseKey'
import { slide } from '../ui/transition'
import { useActivitySender } from '../views/useActivitySender'
import { useWakeLock } from '../ui/wakeLock'
import { BoardStage } from '../views/board'
import { BOARD_ONLY, Controller } from '../views/controller'
import { GameHeader } from '../views/GameHeader'
import { DebugBar } from '../debug/DebugBar'
import { Bot } from '../bot/Bot'
import { resolveBot, resolveMode } from '../start/mode'
import { PlayWaiting } from '../play/phases/PlayWaiting'
import { useRecordSession } from '../store/useRecordSession'
import { BoardLightsOut } from '../board/phases/BoardLightsOut'
import { AwayScreen } from '../views/AwayScreen'
import { JoinedTheirs } from '../views/JoinedTheirs'

// Phones-only renderer: one device, one screen, one thing on it at a time. A phase
// either has something private to ask this player for (the board and the controller
// would just be saying the same thing twice — the theme, the round, the same spectrum
// — so only the controller shows), or it doesn't (join, a reveal, a result — nothing
// to ask, so the board gets the whole screen). They never stack: that's what read as
// two devices squeezed onto one.
// What's on screen trails the live session by a frame at each new screen: the change is
// handed to a screen transition, which snapshots the old screen first and then deals the
// new one in. Anything smaller (a tap, a tick) goes straight through.
function useDealt(live: SessionState): SessionState {
  const [shown, setShown] = useState(live)
  const latest = useRef(live)
  latest.current = live
  const key = useRef(screenKey(live))
  useLayoutEffect(() => {
    const next = screenKey(live)
    if (next === key.current) {
      if (shown !== live) setShown(live)
      return
    }
    key.current = next
    slide('deal', () => setShown(latest.current))
  })
  return screenKey(shown) === key.current ? live : shown
}

export function Duo() {
  const profile = useProfile()
  const myName = profile?.state === 'paired' ? profile.me.name : ''
  const solo = resolveMode(location.search) === 'solo'
  useEffect(() => { if (!solo) fetchBaseline(myName) }, [myName, solo])
  const live = useSession()
  const s = useDealt(live)
  const me = useMyPlayerId()
  const debug = new URLSearchParams(location.search).get('debug') === '1'
  const bot = resolveBot(location.search) || resolveMode(location.search) === 'solo'
  useRecordSession(live)
  useActivitySender(screenKey(s))
  useWakeLock()
  if (!me) return <PlayWaiting label="Connecting…" />
  if (s.paused?.away) return <AwayScreen s={s} />
  // The night's last card is dark and full-bleed: no header, no padding.
  if (s.phase === 'LIGHTS_OUT') {
    return (
      <div className="h-full w-full flex flex-col">
        <div className="flex-1 min-h-0"><BoardLightsOut s={s} /></div>
        {debug && <DebugBar s={s} />}
        {bot && <Bot />}
      </div>
    )
  }
  return (
    <div className="h-full w-full flex flex-col select-none">
      <GameHeader s={s} />
      <JoinedTheirs s={s} me={me} />
      {/* Scrolls rather than clips when a keyboard leaves it short — the header above
          (and its clock) stays put either way. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {BOARD_ONLY.has(s.phase) ? (
          <div className="h-full overflow-y-auto p-5 flex flex-col">
            <div className="my-auto w-full">
              <BoardStage s={s} />
            </div>
          </div>
        ) : (
          <Controller s={s} me={me} />
        )}
      </div>
      {debug && <DebugBar s={s} />}
      {bot && <Bot />}
    </div>
  )
}
