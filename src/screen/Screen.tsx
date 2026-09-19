import type { SessionState } from '../engine/state'
import { useSession } from '../net/playroom'
import { Clock } from './Clock'
import { DebugBar } from '../debug/DebugBar'
import { BoardStage, railText } from '../views/board'

// Shared-screen renderer: the public board on a TV/laptop. Four fixed regions —
// act rail, stage, pot, clock — that never move; only their contents change.
export function Screen() {
  const s = useSession()
  const debug = new URLSearchParams(location.search).get('debug') === '1'
  return (
    <div className="h-full w-full flex flex-col p-6 sm:p-10 select-none">
      <div className="text-sm sm:text-lg uppercase tracking-[0.25em] text-fg/70 border-b-2 border-fg/80 pb-3">
        {railText(s)}
      </div>
      <div className="flex-1 flex items-center justify-center py-6">
        <BoardStage s={s} />
      </div>
      <div className="flex justify-between items-end border-t-2 border-fg/80 pt-3">
        <Pot s={s} />
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-fg/40">Time</div>
          <div className="text-4xl sm:text-5xl leading-none">
            <Clock phaseEndsAt={s.phaseEndsAt} />
          </div>
        </div>
      </div>
      {debug && <DebugBar s={s} />}
    </div>
  )
}

function Pot({ s }: { s: SessionState }) {
  const pot = s.forfeits.filter((f) => f.state === 'pot').length
  const owed = (p: 'A' | 'B') => s.forfeits.filter((f) => f.state === 'owed' && f.owedBy === p).length
  return (
    <div className="flex items-end gap-6 sm:gap-10">
      <div>
        <div className="text-xs uppercase tracking-widest text-fg/40">Pot</div>
        <div className="text-4xl sm:text-5xl font-bold tabular-nums leading-none">{pot}</div>
      </div>
      <div className="text-sm sm:text-base uppercase tracking-wider text-fg/60 tabular-nums">
        <div>{(s.players.A.name || 'A')} owes {owed('A')}</div>
        <div>{(s.players.B.name || 'B')} owes {owed('B')}</div>
      </div>
    </div>
  )
}
