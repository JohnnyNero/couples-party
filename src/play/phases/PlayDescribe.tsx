import { useEffect, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { describeWord } from '../../engine/reducer'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { Clock } from '../../board/Clock'
import { inkOf } from '../../ui/Avatar'
import { eyebrow } from '../../ui/styles'

// The describer's phone: the word, big, with Got it and Skip. The guesser's: shout!
//
// A tap names the word it's for (`at`), so however slowly it reaches the other phone, or
// however many times it's pressed, it only ever counts once. Until the next word shows,
// the buttons hold and the word dims — so you can see it's on its way, rather than tap
// again — and if it's slow, it's sent again.
export function PlayDescribe({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.describe!
  const turn = g.turns[g.current]
  const [sent, setSent] = useState<{ at: number; type: 'DESCRIBE_GOT' | 'DESCRIBE_SKIP' } | null>(null)
  const pending = sent !== null && sent.at === g.next
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    setSlow(false)
    if (!pending) return
    const again = setInterval(() => { setSlow(true); dispatch({ type: sent!.type, player: me, at: sent!.at }, { quiet: true }) }, 1500)
    return () => clearInterval(again)
  }, [pending, sent, me])
  const tap = (type: 'DESCRIBE_GOT' | 'DESCRIBE_SKIP') => {
    if (pending) return
    setSent({ at: g.next, type })
    dispatch({ type, player: me, at: g.next })
  }
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
        <div key={g.next} className={'font-display text-5xl font-extrabold leading-tight break-words animate-reveal-pop transition-opacity ' + (pending ? 'opacity-30' : '')}>{describeWord(g)}</div>
        <div className="text-sm font-bold text-fg/50">
          {slow ? `Sending… keep ${playerName(s, other(me))}’s phone awake` : `${turn.got.length} got · ${turn.skipped.length} skipped`}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <button
          className="min-h-[72px] rounded-2xl border-2 border-fg/25 bg-card font-display text-xl font-extrabold text-fg/70 press disabled:opacity-40"
          disabled={pending}
          onClick={() => tap('DESCRIBE_SKIP')}
        >
          Skip
        </button>
        <button
          className="min-h-[72px] rounded-2xl bg-sage-ink text-white font-display text-2xl font-extrabold press disabled:opacity-40"
          disabled={pending}
          onClick={() => tap('DESCRIBE_GOT')}
        >
          Got it ✓
        </button>
      </div>
    </div>
  )
}
