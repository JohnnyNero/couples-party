import type { SessionState } from '../../engine/state'
import { playerName } from '../../views/list'
import { drawQuestion } from '../../views/draw'
import { useMyPlayerId } from '../../net'

// The board shows the question — it's about the drawer, and knowing it is half the
// guess — but never their answer or the drawing in progress.
export function ScreenDrawSketch({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const d = s.draw!
  const round = d.rounds[d.current]
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Round {round.index} of {d.rounds.length} · {playerName(s, round.drawer)} is drawing
      </div>
      <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight">{drawQuestion(s, round, me)}</div>
    </div>
  )
}
