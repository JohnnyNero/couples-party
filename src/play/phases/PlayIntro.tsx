import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { GAME_LABELS } from '../../engine/roster'
import { dispatch } from '../../net'
import { GameIcon } from '../../ui/GameIcon'
import { ReadyButton } from '../../screen/phases/ScreenIntro'
import { playerName } from '../../views/list'

// With a TV, the title card is up on the board; the phone just says which game and holds
// the Ready button.
export function PlayIntro({ s, me }: { s: SessionState; me: PlayerId }) {
  const intro = s.intro!
  return (
    <div className="h-full flex flex-col justify-center items-center gap-5 p-6 text-center">
      <GameIcon game={intro.key} size="lg" />
      <div className="font-display text-3xl font-extrabold leading-tight">{GAME_LABELS[intro.key]}</div>
      <div className="text-sm text-fg/60">How to play is up on the screen.</div>
      <div className="w-full mt-2">
        <ReadyButton ready={intro.ready[me]} onReady={() => dispatch({ type: 'READY', player: me })} waitingFor={playerName(s, other(me))} />
      </div>
    </div>
  )
}
