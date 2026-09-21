import type { SessionState } from '../../engine/state'
import { FINGER } from '../../engine/phases'
import { Dot } from '../../views/Dot'

export function ScreenFingerRound({ s }: { s: SessionState }) {
  const f = s.finger!
  const round = f.rounds[f.current]
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Put a finger down · {round.index} of {FINGER.rounds}
      </div>
      <div className="text-2xl sm:text-5xl font-bold uppercase tracking-tight break-words">
        If {round.statementId}
      </div>
      <div className="mt-8 sm:mt-14 flex items-center justify-center gap-4">
        <Dot on={round.applies.A !== null} />
        <Dot on={round.applies.B !== null} />
      </div>
    </div>
  )
}
