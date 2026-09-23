import type { PlayerId, SessionState } from '../../engine/state'
import { PlayWaiting } from './PlayWaiting'
import { CountIt } from '../../screen/phases/ScreenDrawReveal'

// Shared-screen mode: the reveal is on the board, so the only thing the phone offers is
// the drawer's "count it" on a near miss. Everyone else just watches.
export function PlayDrawReveal({ s, me }: { s: SessionState; me: PlayerId }) {
  const round = s.draw!.rounds[s.draw!.current]
  if (me !== round.drawer || round.correct || !round.guess || !round.answer) return <PlayWaiting label="Reveal" />
  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4 text-center">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">They guessed</div>
      <div className="text-3xl font-bold uppercase tracking-tight break-words">"{round.guess}"</div>
      <div className="text-sm text-fg/60">You said "{round.answer}". Near enough?</div>
      <CountIt me={me} />
    </div>
  )
}
