import type { PlayerId, SessionState } from '../../engine/state'
import { describeWord } from '../../engine/reducer'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { Clock } from '../../screen/Clock'
import { inkOf } from '../../ui/Avatar'
import { eyebrow } from '../../ui/styles'

// The describer's phone: the word, big, with Got it and Skip. The guesser's: shout!
export function PlayDescribe({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.describe!
  const turn = g.turns[g.current]
  const clock = (
    <span className="shrink-0 min-w-[3.5rem] h-12 px-3 rounded-full bg-fg text-bg inline-flex items-center justify-center font-display text-2xl font-extrabold tabular-nums">
      <Clock phaseEndsAt={s.phaseEndsAt} />
    </span>
  )
  if (me !== turn.describer) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        {clock}
        <div className="font-display text-4xl font-extrabold leading-tight">Shout your guesses!</div>
        <div className="text-fg/60">{playerName(s, turn.describer)} is describing.</div>
        <div className={'font-display text-7xl font-extrabold tabular-nums ' + inkOf(turn.describer)}>{turn.got.length}</div>
        <div className="text-sm font-bold text-fg/50">got so far</div>
      </div>
    )
  }
  return (
    <div className="h-full flex flex-col px-5 pb-6 gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className={eyebrow}>Describe it — don’t say it</div>
        {clock}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <div key={g.next} className="font-display text-5xl font-extrabold leading-tight break-words animate-reveal-pop">{describeWord(g)}</div>
        <div className="text-sm font-bold text-fg/50">{turn.got.length} got · {turn.skipped.length} skipped</div>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <button
          className="min-h-[72px] rounded-2xl border-2 border-fg/25 bg-card font-display text-xl font-extrabold text-fg/70 active:translate-y-px"
          onClick={() => dispatch({ type: 'DESCRIBE_SKIP', player: me })}
        >
          Skip
        </button>
        <button
          className="min-h-[72px] rounded-2xl bg-sage-ink text-white font-display text-2xl font-extrabold active:translate-y-px"
          onClick={() => dispatch({ type: 'DESCRIBE_GOT', player: me })}
        >
          Got it ✓
        </button>
      </div>
    </div>
  )
}
