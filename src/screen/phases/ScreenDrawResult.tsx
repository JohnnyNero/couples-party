import type { SessionState } from '../../engine/state'
import { standing } from '../../engine/standing'
import { playerName } from '../../views/list'

export function ScreenDrawResult({ s }: { s: SessionState }) {
  const tally = standing(s)
  const a = tally.A
  const b = tally.B
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Draw Your Love · final score
      </div>
      <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight tabular-nums">
        {playerName(s, 'A')} {a} <span className="text-fg/30">·</span> {playerName(s, 'B')} {b}
      </div>
      <div className="mt-6 sm:mt-10 text-lg sm:text-2xl font-bold uppercase tracking-tight text-accent">
        {a === b ? "It's a tie" : `${playerName(s, a > b ? 'A' : 'B')} wins`}
      </div>
    </div>
  )
}
