import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { playerName } from '../../views/list'
import { inkOf } from '../../ui/Avatar'
import { eyebrow } from '../../ui/styles'
import { PlayWaiting } from './PlayWaiting'
import { CountIt } from '../../screen/phases/ScreenDrawReveal'

// Shared-screen mode: the reveal is on the board, so the only thing the phone offers is
// the drawer's "count it" on a near miss. Everyone else just watches.
export function PlayDrawReveal({ s, me }: { s: SessionState; me: PlayerId }) {
  const round = s.draw!.rounds[s.draw!.current]
  if (me !== round.drawer || round.correct || !round.guess || !round.answer) return <PlayWaiting label="See the board" />
  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center gap-2 text-center">
        <div className={eyebrow}>{playerName(s, other(me))} guessed</div>
        <div className={'font-display text-4xl font-extrabold leading-tight break-words ' + inkOf(other(me))}>“{round.guess}”</div>
        <div className="text-base text-fg/65">You said “{round.answer}”. Near enough?</div>
      </div>
      <CountIt me={me} />
    </div>
  )
}
