import type { SessionState } from '../../engine/state'
import { Dot } from '../../views/Dot'
import { liveClock, seconds } from '../../views/fillers'
import { playerName } from '../../views/list'

export function ScreenClockRun({ s }: { s: SessionState }) {
  const live = liveClock(s)!
  const round = live.game.rounds[live.game.current]
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        {live.decider ? 'Tiebreaker' : `Stop the Clock · round ${round.index}`}
      </div>
      <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight">Stop at {seconds(round.targetMs, 1)}</div>
      <div className="mt-2 sm:mt-4 text-sm sm:text-xl text-fg/60">The clock is running · tap Stop on your phone</div>
      <div className="mt-6 sm:mt-10 flex justify-center gap-8">
        {(['A', 'B'] as const).map((p) => (
          <span key={p} className="flex items-center gap-2 text-sm sm:text-xl uppercase tracking-wide">
            <Dot on={round.stopped[p] !== null} /> {playerName(s, p)}
          </span>
        ))}
      </div>
    </div>
  )
}
