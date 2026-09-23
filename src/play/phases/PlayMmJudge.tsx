import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { playerName } from '../../views/list'
import { Judge } from '../../screen/phases/ScreenMmJudge'
import { PlayWaiting } from './PlayWaiting'

// Shared-screen mode: both cards are on the board; the phone only asks you to rule on
// the guess about YOU, if it wasn't an obvious call.
export function PlayMmJudge({ s, me }: { s: SessionState; me: PlayerId }) {
  const round = s.mrmrs!.rounds[s.mrmrs!.current]
  const predictor = other(me)
  if (round.verdict[predictor] !== null) return <PlayWaiting label="See the board" />
  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4 text-center">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">You said</div>
      <div className="text-2xl font-bold uppercase tracking-tight break-words">{round.answer[me]}</div>
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mt-2">{playerName(s, predictor)} guessed</div>
      <div className="text-2xl font-bold uppercase tracking-tight break-words text-accent">{round.predict[predictor]}</div>
      <div className="flex justify-center mt-2"><Judge me={me} /></div>
    </div>
  )
}
