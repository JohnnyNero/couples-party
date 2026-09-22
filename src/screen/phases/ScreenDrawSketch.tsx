import type { SessionState } from '../../engine/state'
import { DRAW } from '../../engine/phases'
import { playerName } from '../../views/list'

// The board never shows the prompt or the drawing in progress — only the phone that
// owns the round sees either. No live streaming, just "they're on it."
export function ScreenDrawSketch({ s }: { s: SessionState }) {
  const d = s.draw!
  const round = d.rounds[d.current]
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Round {round.index} of {DRAW.rounds} · {playerName(s, round.drawer)} is drawing
      </div>
      <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight">Quick Draw</div>
    </div>
  )
}
