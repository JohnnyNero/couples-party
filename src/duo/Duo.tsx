import { useSession, useMyPlayerId } from '../net'
import { BoardStage } from '../views/board'
import { Controller } from '../views/controller'
import { GameHeader } from '../views/GameHeader'
import { DebugBar } from '../debug/DebugBar'
import { Bot } from '../bot/Bot'
import { resolveBot, resolveMode } from '../start/mode'
import { PlayWaiting } from '../play/phases/PlayWaiting'
import { useRecordSession } from '../store/useRecordSession'
import { ScreenLightsOut } from '../screen/phases/ScreenLightsOut'
import { AwayScreen } from '../views/AwayScreen'

// Phones-only renderer: one device, one screen, one thing on it at a time. A phase
// either has something private to ask this player for (the board and the controller
// would just be saying the same thing twice — the theme, the round, the same spectrum
// — so only the controller shows), or it doesn't (join, a reveal, a result — nothing
// to ask, so the board gets the whole screen). They never stack: that's what read as
// two devices squeezed onto one.
const BOARD_ONLY = new Set([
  'JOIN', 'INTRO',
  'LIST_INTRO', 'LIST_REVEAL', 'LIST_RESULT',
  'LIKELY_REVEAL', 'LIKELY_RESULT',
  'MM_JUDGE', 'MM_RESULT',
  'LIGHTS_OUT',
  'FINGER_REVEAL', 'FINGER_RESULT',
  'WAVE_REVEAL', 'WAVE_RESULT',
  'DRAW_REVEAL', 'DRAW_RESULT',
  'CLASH_REVEAL', 'CLASH_RESULT',
  'CHAIN_END', 'CHAIN_RESULT',
  'BLUFF_REVEAL', 'BLUFF_RESULT',
  'MELD_REVEAL', 'MELD_RESULT',
  'CIRCLE_REVEAL', 'CIRCLE_RESULT',
  'CLOCK_READY', 'CLOCK_REVEAL', 'CLOCK_RESULT',
  'DECIDER_READY', 'DECIDER_REVEAL',
  'DONE',
])

export function Duo() {
  const s = useSession()
  const me = useMyPlayerId()
  const debug = new URLSearchParams(location.search).get('debug') === '1'
  const bot = resolveBot(location.search) || resolveMode(location.search) === 'solo'
  useRecordSession(s)
  if (!me) return <PlayWaiting label="Connecting…" />
  if (s.paused?.away) return <AwayScreen s={s} />
  // The night's last card is dark and full-bleed: no header, no padding.
  if (s.phase === 'LIGHTS_OUT') {
    return (
      <div className="h-full w-full flex flex-col">
        <div className="flex-1 min-h-0"><ScreenLightsOut s={s} /></div>
        {debug && <DebugBar s={s} />}
        {bot && <Bot />}
      </div>
    )
  }
  return (
    <div className="h-full w-full flex flex-col select-none">
      <GameHeader s={s} />
      <div className="flex-1 min-h-0">
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
