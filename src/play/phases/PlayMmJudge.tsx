import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { playerName } from '../../views/list'
import { Judge } from '../../screen/phases/ScreenMmJudge'
import { inkOf } from '../../ui/Avatar'
import { eyebrow } from '../../ui/styles'
import { PlayWaiting } from './PlayWaiting'

// Shared-screen mode: both cards are on the board; the phone only asks you to rule on
// the guess about YOU, if it wasn't an obvious call.
export function PlayMmJudge({ s, me }: { s: SessionState; me: PlayerId }) {
  const round = s.mrmrs!.rounds[s.mrmrs!.current]
  const predictor = other(me)
  if (round.verdict[predictor] !== null) return <PlayWaiting label="See the board" />
  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center gap-2 text-center">
        <div className={eyebrow}>You said</div>
        <div className={'font-display text-3xl font-extrabold leading-tight break-words ' + inkOf(me)}>{round.answer[me]}</div>
        <div className={eyebrow + ' mt-4'}>{playerName(s, predictor)} guessed</div>
        <div className={'font-display text-3xl font-extrabold leading-tight break-words ' + inkOf(predictor)}>{round.predict[predictor]}</div>
      </div>
      <Judge me={me} big />
    </div>
  )
}
