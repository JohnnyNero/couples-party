import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { ClashRevealControls } from '../../screen/phases/ScreenClashReveal'
import { playerName } from '../../views/list'

// With a TV, the table is up on the board; the phone is the challenge button and the tap
// that moves it on.
export function PlayClashReveal({ s, me }: { s: SessionState; me: PlayerId }) {
  const round = s.clash!.rounds[s.clash!.current]
  const i = round.revealIndex
  return (
    <div className="h-full flex flex-col justify-center p-6 gap-5">
      <div className="text-center">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-2">
          Category {i + 1} of {round.categories.length} · on the board
        </div>
        <div className="text-2xl font-bold uppercase tracking-tight">{round.categories[i]}</div>
        <div className="mt-1 text-sm text-fg/60">
          {playerName(s, other(me))} said "{round.answers[other(me)]?.[i] || '—'}"
        </div>
      </div>
      <ClashRevealControls s={s} me={me} />
    </div>
  )
}
