import type { PlayerId, SessionState } from '../engine/state'
import { leaderboardView } from './leaderboardView'

// Compact single-line version — sits next to a clock or in a footer strip.
export function LeaderboardInline({ s, me }: { s: SessionState; me: PlayerId }) {
  const v = leaderboardView(s, me)
  return (
    <span className="uppercase truncate max-w-[60vw] inline-block align-bottom tabular-nums">
      <span className={v.session.you > v.session.them ? 'text-accent' : 'text-fg'}>
        {v.you} {v.session.you}
      </span>
      <span className="text-fg/30"> · </span>
      <span className={v.session.them > v.session.you ? 'text-accent' : 'text-fg'}>
        {v.them} {v.session.them}
      </span>
      <span className="text-fg/30 pl-2">
        wk {v.weekly.you}-{v.weekly.them} · all {v.allTime.you}-{v.allTime.them}
      </span>
    </span>
  )
}

// Larger block version for a footer with room to breathe.
export function LeaderboardBlock({ s, me }: { s: SessionState; me: PlayerId }) {
  const v = leaderboardView(s, me)
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-widest text-fg/40">This session</div>
      <div className="text-lg sm:text-2xl font-bold uppercase tracking-tight tabular-nums truncate">
        <Side name={v.you} n={v.session.you} ahead={v.session.you > v.session.them} />
        <span className="text-fg/20 px-2">·</span>
        <Side name={v.them} n={v.session.them} ahead={v.session.them > v.session.you} />
      </div>
      <div className="mt-1 text-[0.6rem] sm:text-sm uppercase tracking-wide tabular-nums text-fg/50 truncate">
        Week {v.weekly.you}-{v.weekly.them} · All-time {v.allTime.you}-{v.allTime.them}
      </div>
    </div>
  )
}

function Side({ name, n, ahead }: { name: string; n: number; ahead: boolean }) {
  return <span className={ahead ? 'text-accent' : ''}>{name} {n}</span>
}
