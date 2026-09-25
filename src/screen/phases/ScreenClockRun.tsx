import type { SessionState } from '../../engine/state'
import { liveClock, seconds } from '../../views/fillers'
import { WhoIsIn } from '../../ui/kit'

export function ScreenClockRun({ s }: { s: SessionState }) {
  const live = liveClock(s)!
  const round = live.game.rounds[live.game.current]
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center gap-6">
      {live.decider && <div className="text-sm sm:text-lg font-extrabold text-pa-ink">Tiebreaker</div>}
      <div className="font-display text-4xl sm:text-6xl font-extrabold">Stop at {seconds(round.targetMs, 1)}</div>
      <div className="font-display text-8xl sm:text-9xl font-extrabold text-fg/15 tabular-nums leading-none">?.??</div>
      <div className="text-base sm:text-xl text-fg/60">The clock is running · tap Stop on your phone</div>
      <WhoIsIn s={s} done={{ A: round.stopped.A !== null, B: round.stopped.B !== null }} big waiting={() => 'Counting…'} />
    </div>
  )
}
