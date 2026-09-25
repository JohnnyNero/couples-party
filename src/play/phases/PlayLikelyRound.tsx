import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { PlayWaiting } from './PlayWaiting'

// Two names, one tap, no changing your mind. Your own name is first — it's the more
// honest answer surprisingly often, and it shouldn't be the one you have to reach for.
export function PlayLikelyRound({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.likely!
  const round = g.rounds[g.current]
  if (round.picks[me] !== null) return <PlayWaiting label="Locked in — waiting on them" />

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4">
      <div>
        <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50 mb-2">Who's more likely to</div>
        <div className="text-2xl font-display font-extrabold leading-tight break-words">{round.statement}?</div>
      </div>
      {[me, other(me)].map((p, i) => (
        <button
          key={p}
          onClick={() => dispatch({ type: 'PICK_LIKELY', player: me, pick: p })}
          className={
            'w-full min-h-[72px] rounded-2xl text-2xl font-bold uppercase tracking-widest active:translate-y-px ' +
            (i === 0 ? 'bg-ink text-paper' : 'bg-accent text-paper')
          }
        >
          {p === me ? 'Me' : playerName(s, p)}
        </button>
      ))}
      <div className="text-xs uppercase tracking-wide text-fg/40 text-center">
        Agree and you both score
      </div>
    </div>
  )
}
