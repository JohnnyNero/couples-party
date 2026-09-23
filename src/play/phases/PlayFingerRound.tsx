import type { PlayerId, SessionState } from '../../engine/state'
import { dispatch } from '../../net'
import { PlayWaiting } from './PlayWaiting'

// A private, honest yes/no — no changing your mind once it's tapped.
export function PlayFingerRound({ s, me }: { s: SessionState; me: PlayerId }) {
  const f = s.finger!
  const round = f.rounds[f.current]
  const answered = round.applies[me] !== null

  if (answered) return <PlayWaiting label="Locked in — waiting" />

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-2">Put a finger down if</div>
        <div className="text-xl font-bold uppercase tracking-tight">{round.statementId}</div>
      </div>
      <button
        className="w-full min-h-[64px] bg-ink text-paper text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={() => dispatch({ type: 'SUBMIT_FINGER', player: me, applies: true })}
      >
        Finger down
      </button>
      <button
        className="w-full min-h-[64px] border-2 border-fg/30 text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={() => dispatch({ type: 'SUBMIT_FINGER', player: me, applies: false })}
      >
        Stays up
      </button>
    </div>
  )
}
