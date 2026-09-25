import { useSession, useMyPlayerId } from '../net'
import { BoardStage, railText } from '../views/board'
import { Controller } from '../views/controller'
import { Clock } from '../screen/Clock'
import { DebugBar } from '../debug/DebugBar'
import { Bot } from '../bot/Bot'
import { resolveBot, resolveMode } from '../start/mode'
import { PlayWaiting } from '../play/phases/PlayWaiting'
import { LeaderboardInline } from '../views/Leaderboard'
import { useRecordSession } from '../store/useRecordSession'

// Phones-only renderer: one device, one screen, one thing on it at a time. A phase
// either has something private to ask this player for (the board and the controller
// would just be saying the same thing twice — the theme, the round, the same spectrum
// — so only the controller shows), or it doesn't (join, a reveal, a result — nothing
// to ask, so the board gets the whole screen). They never stack: that's what read as
// two devices squeezed onto one.
const BOARD_ONLY = new Set([
  'JOIN',
  'LIST_INTRO', 'LIST_REVEAL', 'LIST_RESULT',
  'LIKELY_REVEAL', 'LIKELY_RESULT',
  'MM_JUDGE', 'MM_RESULT',
  'LIGHTS_OUT',
  'FINGER_REVEAL', 'FINGER_RESULT',
  'WAVE_REVEAL', 'WAVE_RESULT',
  'DRAW_REVEAL', 'DRAW_RESULT',
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
  return (
    <div className="h-full w-full flex flex-col select-none">
      <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-fg/60 px-5 pt-4 pb-2 shrink-0">
        <span className="truncate pr-2">{railText(s)}</span>
        <span className="flex items-center gap-3 shrink-0">
          <LeaderboardInline s={s} me={me} />
          <span className="tabular-nums text-fg/80">
            <Clock phaseEndsAt={s.phaseEndsAt} />
          </span>
        </span>
      </div>
      <div className="flex-1 min-h-0">
        {BOARD_ONLY.has(s.phase) ? (
          <div className="h-full flex items-center justify-center overflow-hidden p-5">
            <BoardStage s={s} />
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
