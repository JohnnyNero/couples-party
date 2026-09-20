import type { SessionState } from '../engine/state'
import { useSession } from '../net/playroom'
import { Clock } from './Clock'
import { DebugBar } from '../debug/DebugBar'
import { BoardStage, railText } from '../views/board'
import { standing } from '../engine/standing'
import { playerName } from '../views/list'

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
      <div className="flex justify-between items-end gap-6 border-t-2 border-fg/80 pt-3">
        <Stake s={s} />
        <div className="text-right shrink-0">
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

function Stake({ s }: { s: SessionState }) {
  const owed = s.stakeOwedBy ? playerName(s, s.stakeOwedBy) : null
  const tally = standing(s)
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-widest text-fg/40">
        {owed ? `${owed} does` : 'The forfeit'}
      </div>
      <div className="text-lg sm:text-2xl font-bold uppercase tracking-tight truncate">
        {s.stake ?? '—'}
      </div>
      {/* Standing is derived from the acts, never stored — see engine/standing.ts. */}
      <div className="mt-1 text-sm sm:text-lg uppercase tracking-wide tabular-nums text-fg/60">
        <Side name={playerName(s, 'A')} n={tally.A} ahead={tally.A > tally.B} />
        <span className="text-fg/20 px-2">·</span>
        <Side name={playerName(s, 'B')} n={tally.B} ahead={tally.B > tally.A} />
      </div>
    </div>
  )
}

function Side({ name, n, ahead }: { name: string; n: number; ahead: boolean }) {
  return (
    <span className={ahead ? 'text-accent' : ''}>
      {name} {n}
    </span>
  )
}
