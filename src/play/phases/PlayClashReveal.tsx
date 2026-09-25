import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { ClashRevealControls } from '../../screen/phases/ScreenClashReveal'
import { playerName } from '../../views/list'
import { Said } from '../../ui/kit'
import { eyebrow } from '../../ui/styles'

// With a TV, the table is up on the board; the phone is the challenge button and the tap
// that moves it on.
export function PlayClashReveal({ s, me }: { s: SessionState; me: PlayerId }) {
  const round = s.clash!.rounds[s.clash!.current]
  const i = round.revealIndex
  const them = other(me)
  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center items-center text-center gap-3">
        <div className={eyebrow}>Category {i + 1} of {round.categories.length} · on the board</div>
        <div className="font-display text-3xl font-extrabold leading-tight">{round.categories[i]}</div>
        <div className="text-sm font-bold text-fg/55">{playerName(s, them)} said</div>
        <Said s={s} p={them}>{round.answers[them]?.[i] || '—'}</Said>
      </div>
      <ClashRevealControls s={s} me={me} />
    </div>
  )
}
