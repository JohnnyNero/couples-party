import type { SessionState } from '../engine/state'
import { useSession, useMyPlayerId } from '../net/playroom'
import { BoardStage, railText } from '../views/board'
import { Controller } from '../views/controller'
import { Clock } from '../screen/Clock'
import { DebugBar } from '../debug/DebugBar'
import { PlayWaiting } from '../play/phases/PlayWaiting'

// Phones-only renderer: no shared screen, so each phone carries BOTH the public
// board (top) and this player's private controller (bottom). Reveals fire on both
// phones at once off phaseEndsAt, so nothing invents a winner.
export function Duo() {
  const s = useSession()
  const me = useMyPlayerId()
  const debug = new URLSearchParams(location.search).get('debug') === '1'
  if (!me) return <PlayWaiting label="Connecting…" />
  return (
    <div className="h-full w-full flex flex-col select-none">
      {/* Board region — public truth. */}
      <div className="basis-[44%] shrink-0 flex flex-col p-5 border-b-4 border-fg/80">
        <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-fg/60 pb-2">
          <span className="truncate pr-2">{railText(s)}</span>
          <span className="flex items-center gap-3 shrink-0">
            <PotInline s={s} />
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
      <div className="flex-1 min-h-0">
        <Controller s={s} me={me} />
      </div>
      {debug && <DebugBar s={s} />}
    </div>
  )
}

function PotInline({ s }: { s: SessionState }) {
  const pot = s.forfeits.filter((f) => f.state === 'pot').length
  return (
    <span className="uppercase">
      Pot <span className="tabular-nums text-fg">{pot}</span>
    </span>
  )
}
