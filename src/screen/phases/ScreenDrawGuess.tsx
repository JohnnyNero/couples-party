import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { DRAW } from '../../engine/phases'
import { Dot } from '../../views/Dot'
import { DrawingCanvas } from '../../views/DrawingCanvas'
import { playerName } from '../../views/list'

// The finished drawing is public now — everyone in the room can see it. Only the guess
// itself stays private until the reveal.
export function ScreenDrawGuess({ s }: { s: SessionState }) {
  const d = s.draw!
  const round = d.rounds[d.current]
  return (
    <div className="w-full max-w-md mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Round {round.index} of {DRAW.rounds} · {playerName(s, other(round.drawer))} is guessing
      </div>
      <DrawingCanvas strokes={round.strokes} animate />
      <div className="mt-6 flex items-center justify-center gap-4">
        <Dot on={round.guess !== null} />
      </div>
    </div>
  )
}
