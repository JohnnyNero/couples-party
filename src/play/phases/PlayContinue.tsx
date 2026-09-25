import type { PlayerId, SessionState } from '../../engine/state'
import { standing } from '../../engine/standing'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { btnPrimary, eyebrow } from '../../ui/styles'

// Shared-screen mode only: the board has the scoreboard on it, so the phone is just the
// hand that moves the night on. In phones-only mode the board is the phone and its own
// button does this job.
export function PlayContinue({ s, me, label = 'Ready' }: { s: SessionState; me: PlayerId; label?: string }) {
  const t = standing(s)
  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <div className={eyebrow}>On the board</div>
        <div className="flex items-center gap-6">
          {(['A', 'B'] as PlayerId[]).map((p) => (
            <div key={p} className="flex flex-col items-center gap-1">
              <Avatar p={p} name={playerName(s, p)} size="md" />
              <span className={'font-display text-4xl font-extrabold tabular-nums ' + inkOf(p)}>{t[p]}</span>
            </div>
          ))}
        </div>
        <div className="text-sm text-fg/55">Either of you can tap — there’s no clock on this bit.</div>
      </div>
      <button className={btnPrimary} onClick={() => dispatch({ type: 'CONTINUE', player: me })}>
        {label}
      </button>
    </div>
  )
}
