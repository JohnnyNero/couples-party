import type { SessionState } from '../../engine/state'
import { Dot } from '../../views/Dot'

export function ScreenLikelyRound({ s }: { s: SessionState }) {
  const g = s.likely!
  const round = g.rounds[g.current]
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Who's more likely to
      </div>
      <div className="text-2xl sm:text-5xl font-bold uppercase tracking-tight break-words">
        {round.statement}?
      </div>
      <div className="mt-8 sm:mt-14 flex items-center justify-center gap-4">
        <Dot on={round.picks.A !== null} />
        <Dot on={round.picks.B !== null} />
      </div>
    </div>
  )
}
