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

// Phones-only renderer: no shared screen, so each phone carries BOTH the public
// board (top) and this player's private controller (bottom). Reveals fire on both
// phones at once off phaseEndsAt, so nothing invents a winner.
// Phases where the controller is only a waiting state: the board should have the screen
// to itself rather than sitting in the top 44% with an empty panel beneath it.
const BOARD_LED = new Set(['MELD_REVEAL', 'MELD_RESULT', 'LIST_REVEAL', 'FINGER_REVEAL', 'FINGER_RESULT', 'DONE'])
// Phases whose board is just a theme line and a small stat, but whose controller is the
// real interaction (a pool of items, a drag list) — the board takes only what its own
// content needs instead of a fixed share, so the controller gets the rest.
const COMPACT_BOARD = new Set(['LIST_WRITE', 'LIST_SWAP', 'LIST_PLACE'])

export function Duo() {
  const s = useSession()
  const me = useMyPlayerId()
  const debug = new URLSearchParams(location.search).get('debug') === '1'
  const bot = resolveBot(location.search) || resolveMode(location.search) === 'solo'
  useRecordSession(s)
  if (!me) return <PlayWaiting label="Connecting…" />
  return (
    <div className="h-full w-full flex flex-col select-none">
      {/* Board region — public truth. */}
      <div
        className={
          'flex flex-col p-5 ' +
          (BOARD_LED.has(s.phase)
            ? 'flex-1 min-h-0'
            : COMPACT_BOARD.has(s.phase)
              ? 'shrink-0 border-b-4 border-fg/80'
              : 'basis-[44%] shrink-0 border-b-4 border-fg/80')
        }
      >
        <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-fg/60 pb-2">
          <span className="truncate pr-2">{railText(s)}</span>
          <span className="flex items-center gap-3 shrink-0">
            <LeaderboardInline s={s} me={me} />
            <span className="tabular-nums text-fg/80">
              <Clock phaseEndsAt={s.phaseEndsAt} />
            </span>
          </span>
        </div>
        <div
          className={
            COMPACT_BOARD.has(s.phase)
              ? 'py-4 flex items-center justify-center overflow-hidden'
              : 'flex-1 flex items-center justify-center overflow-hidden'
          }
        >
          <BoardStage s={s} />
        </div>
      </div>
      {/* Controller region — this player's private input. */}
      {/* During a reveal the controller has nothing to ask for, and on this device the
          board is right there — so it stands down rather than crowding the result. */}
      {!BOARD_LED.has(s.phase) && (
        <div className="flex-1 min-h-0">
          <Controller s={s} me={me} />
        </div>
      )}
      {debug && <DebugBar s={s} />}
      {bot && <Bot />}
    </div>
  )
}
