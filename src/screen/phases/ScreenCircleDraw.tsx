import type { SessionState } from '../../engine/state'
import { Dot } from '../../views/Dot'
import { playerName } from '../../views/list'

export function ScreenCircleDraw({ s }: { s: SessionState }) {
  const c = s.circle!
  const round = c.rounds[c.current]
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Perfect Circle{c.bestOf > 1 ? ` · round ${round.index}` : ''}
      </div>
      <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight">Draw a perfect circle</div>
      <div className="mt-2 sm:mt-4 text-sm sm:text-xl text-fg/60">One go each · lift your finger to send it</div>
      <div className="mt-6 sm:mt-10 flex justify-center gap-8">
        {(['A', 'B'] as const).map((p) => (
          <span key={p} className="flex items-center gap-2 text-sm sm:text-xl uppercase tracking-wide">
            <Dot on={round.drawn[p] !== null} /> {playerName(s, p)}
          </span>
        ))}
      </div>
    </div>
  )
}
