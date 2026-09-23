import type { PlayerId, SessionState } from '../../engine/state'
import { standing } from '../../engine/standing'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'

// Shared-screen mode only: the board has the scoreboard on it, so the phone is just the
// hand that moves the night on. In phones-only mode the board is the phone and its own
// button does this job.
export function PlayContinue({ s, me, label = 'Ready' }: { s: SessionState; me: PlayerId; label?: string }) {
  const t = standing(s)
  return (
    <div className="h-full flex flex-col justify-center p-6 gap-5">
      <div className="text-center">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-2">On the board</div>
        <div className="text-2xl font-bold uppercase tracking-tight tabular-nums">
          {playerName(s, 'A')} <span className="text-accent">{t.A}</span>
          <span className="text-fg/30"> · </span>
          {playerName(s, 'B')} <span className="text-accent">{t.B}</span>
        </div>
      </div>
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={() => dispatch({ type: 'CONTINUE', player: me })}
      >
        {label}
      </button>
      <div className="text-xs uppercase tracking-wide text-fg/40 text-center">
        Either of you can tap — there's no clock on this bit
      </div>
    </div>
  )
}
