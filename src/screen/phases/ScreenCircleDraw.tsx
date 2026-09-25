import type { SessionState } from '../../engine/state'
import { WhoIsIn } from '../../ui/kit'

export function ScreenCircleDraw({ s }: { s: SessionState }) {
  const c = s.circle!
  const round = c.rounds[c.current]
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center gap-6">
      <svg viewBox="0 0 100 100" className="w-32 h-32 sm:w-48 sm:h-48 text-fg/25" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="6 6" />
      </svg>
      <div>
        <div className="font-display text-4xl sm:text-6xl font-extrabold leading-tight">Draw a perfect circle</div>
        <div className="mt-1 text-base sm:text-xl text-fg/60">One go each · lift your finger to send it</div>
      </div>
      <WhoIsIn s={s} done={{ A: round.drawn.A !== null, B: round.drawn.B !== null }} big waiting={() => 'Drawing…'} />
    </div>
  )
}
