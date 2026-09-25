import { aboutPartner } from '../../views/voice'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { dispatch } from '../../net'
import { Hand, PromptCard, Waiting } from '../../ui/kit'
import { btnOutline, btnPrimary } from '../../ui/styles'
import { inkOf } from '../../ui/Avatar'
import { playerName } from '../../views/list'

// A private, honest yes/no — no changing your mind once it's tapped. The buttons sit at
// the bottom, where your thumb already is.
export function PlayFingerRound({ s, me }: { s: SessionState; me: PlayerId }) {
  const f = s.finger!
  const round = f.rounds[f.current]
  const them = other(me)
  const theyAnswered = round.applies[them] !== null

  if (round.applies[me] !== null) {
    return <Waiting title="Locked in" sub={theyAnswered ? 'Revealing…' : `Waiting for ${playerName(s, them)}`} />
  }

  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center gap-6">
        <PromptCard over="Put a finger down if…">{aboutPartner(s, round.statementId, me)}</PromptCard>
        <div className="flex items-center justify-center gap-3 text-sm font-bold text-fg/60">
          Your hand <Hand fingers={f.fingersLeft[me]} p={me} /> {f.fingersLeft[me]} up
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className={'h-5 text-center text-xs font-extrabold ' + inkOf(them)}>
          {theyAnswered ? `${playerName(s, them)} has answered` : ''}
        </div>
        <button className={btnPrimary + ' min-h-[64px]'} onClick={() => dispatch({ type: 'SUBMIT_FINGER', player: me, applies: true })}>
          Finger down
        </button>
        <button className={btnOutline + ' min-h-[64px]'} onClick={() => dispatch({ type: 'SUBMIT_FINGER', player: me, applies: false })}>
          Keep it up
        </button>
      </div>
    </div>
  )
}
