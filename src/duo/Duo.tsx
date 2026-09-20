import type { SessionState } from '../engine/state'
import { useSession, useMyPlayerId } from '../net'
import { BoardStage, railText } from '../views/board'
import { Controller } from '../views/controller'
import { Clock } from '../screen/Clock'
import { DebugBar } from '../debug/DebugBar'
import { Bot } from '../bot/Bot'
import { resolveBot, resolveMode } from '../start/mode'
import { PlayWaiting } from '../play/phases/PlayWaiting'
import { standing } from '../engine/standing'
import { playerName } from '../views/list'

// Phones-only renderer: no shared screen, so each phone carries BOTH the public
// board (top) and this player's private controller (bottom). Reveals fire on both
// phones at once off phaseEndsAt, so nothing invents a winner.
// Phases where the controller is only a waiting state: the board should have the screen
// to itself rather than sitting in the top 44% with an empty panel beneath it.
const BOARD_LED = new Set(['STAKE_REVEAL', 'MELD_REVEAL', 'MELD_RESULT', 'LIST_REVEAL', 'DONE'])

export function Duo() {
  const s = useSession()
  const me = useMyPlayerId()
  const debug = new URLSearchParams(location.search).get('debug') === '1'
  const bot = resolveBot(location.search) || resolveMode(location.search) === 'solo'
  if (!me) return <PlayWaiting label="Connecting…" />
  return (
    <div className="h-full w-full flex flex-col select-none">
      {/* Board region — public truth. */}
      <div
        className={
          'flex flex-col p-5 ' +
          (BOARD_LED.has(s.phase) ? 'flex-1 min-h-0' : 'basis-[44%] shrink-0 border-b-4 border-fg/80')
        }
      >
        <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-fg/60 pb-2">
          <span className="truncate pr-2">{railText(s)}</span>
          <span className="flex items-center gap-3 shrink-0">
            <StakeInline s={s} />
            <span className="tabular-nums text-fg/80">
              <Clock phaseEndsAt={s.phaseEndsAt} />
            </span>
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center overflow-hidden">
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

function StakeInline({ s }: { s: SessionState }) {
  if (!s.stake) return <span className="uppercase text-fg/40">No stake yet</span>
  const tally = standing(s)
  const scored = tally.A > 0 || tally.B > 0
  return (
    <span className="uppercase truncate max-w-[45vw] inline-block align-bottom">
      {scored ? (
        <span className="tabular-nums">
          <span className={tally.A > tally.B ? 'text-accent' : 'text-fg'}>
            {playerName(s, 'A')} {tally.A}
          </span>
          <span className="text-fg/30"> · </span>
          <span className={tally.B > tally.A ? 'text-accent' : 'text-fg'}>
            {playerName(s, 'B')} {tally.B}
          </span>
        </span>
      ) : (
        <>
          <span className="text-fg/40">Stake </span>
          <span className="text-fg">{s.stake}</span>
        </>
      )}
    </span>
  )
}
