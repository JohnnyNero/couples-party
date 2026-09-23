import type { SessionState } from '../../engine/state'
import { Dot } from '../../views/Dot'

export function ScreenMmAnswer({ s }: { s: SessionState }) {
  const g = s.mrmrs!
  const round = g.rounds[g.current]
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Mr &amp; Mrs · your answer, and your guess at theirs
      </div>
      <div className="text-2xl sm:text-5xl font-bold uppercase tracking-tight break-words">
        {round.question}
      </div>
      <div className="mt-8 sm:mt-14 flex items-center justify-center gap-4">
        <Dot on={round.answer.A !== null} />
        <Dot on={round.answer.B !== null} />
      </div>
    </div>
  )
}
