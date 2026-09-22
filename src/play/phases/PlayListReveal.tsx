import type { PlayerId, SessionState } from '../../engine/state'
import { currentAct } from '../../engine/list'
import { listItemPoints } from '../../engine/standing'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'

// Shared-screen mode only: the comparison is up on the board, so the phone is just the
// hand that moves it on. In phones-only mode the board is the phone and its own button
// does this job — this never renders there.
export function PlayListReveal({ s, me }: { s: SessionState; me: PlayerId }) {
  const act = currentAct(s)!
  const done = act.revealIndex + 1
  const last = act.revealIndex >= act.items.length - 1
  const total = act.items.slice(0, done).reduce((n, i) => n + listItemPoints(i), 0)

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-5">
      <div className="text-center">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-2">
          Item {done} of {act.items.length} · on the board
        </div>
        <div className="text-2xl font-bold uppercase tracking-tight">
          {playerName(s, act.author)} <span className="text-accent tabular-nums">{total}</span>
        </div>
      </div>
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={() => dispatch({ type: 'ADVANCE_REVEAL', player: me })}
      >
        {last ? 'Done' : 'Next item'}
      </button>
      <div className="text-xs uppercase tracking-wide text-fg/40 text-center">
        Either of you can tap — there's no clock on this bit
      </div>
    </div>
  )
}
