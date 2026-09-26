import type { PlayerId, SessionState } from '../../engine/state'
import { currentAct } from '../../engine/list'
import { listItemPoints, shown as scaled } from '../../engine/standing'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { inkOf } from '../../ui/Avatar'
import { btnPrimary, eyebrow } from '../../ui/styles'

// Shared-screen mode only: the comparison is up on the board, so the phone is just the
// hand that moves it on. In phones-only mode the board is the phone and its own button
// does this job — this never renders there.
export function PlayListReveal({ s, me }: { s: SessionState; me: PlayerId }) {
  const act = currentAct(s)!
  const done = act.revealIndex + 1
  const last = act.revealIndex >= act.items.length - 1
  const total = act.items.slice(0, done).reduce((n, i) => n + scaled(s, 'list', listItemPoints(i)), 0)

  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
        <div className={eyebrow}>Item {done} of {act.items.length} · on the board</div>
        <div className="font-display text-3xl font-extrabold">
          {playerName(s, act.author)} <span className={'tabular-nums ' + inkOf(act.author)}>{total}</span>
        </div>
        <div className="text-sm text-fg/55">Either of you can tap — there’s no clock on this bit.</div>
      </div>
      <button className={btnPrimary} onClick={() => dispatch({ type: 'ADVANCE_REVEAL', player: me })}>
        {last ? 'Done' : 'Next item'}
      </button>
    </div>
  )
}
