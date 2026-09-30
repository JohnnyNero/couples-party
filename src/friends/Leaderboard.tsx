import type { LeaderboardRow } from '../daily/api'
import { card, eyebrow } from '../ui/styles'
import { CoupleFaces, coupleName } from './FriendsTab'
import { rankRows } from './rank'

// This week's points for you and your friend couples, best first. Resets every Monday.
// Only totals: it shows no more of anyone's day than their friend card already does.
export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length < 2) {
    return (
      <section className={card + ' p-4 text-center text-sm text-fg/55'}>
        <div className={eyebrow}>Leaderboard · this week</div>
        <div className="mt-1">Add a friend couple to start a leaderboard.</div>
      </section>
    )
  }
  return (
    <section className={card + ' p-4 flex flex-col gap-2'}>
      <div className="flex items-baseline justify-between">
        <div className={eyebrow}>Leaderboard · this week</div>
        <div className="text-[0.7rem] font-bold text-fg/40">Resets Monday</div>
      </div>
      <ol className="flex flex-col gap-1.5">
        {rankRows(rows).map((r) => (
          <li key={r.id} className={'flex items-center gap-3 rounded-2xl px-3 py-2 ' + (r.me ? 'bg-tan-soft text-tan-ink' : 'bg-fg/[0.04]')}>
            <span className="w-6 text-center font-display text-lg font-extrabold tabular-nums">{r.rank}</span>
            <CoupleFaces members={r.members} size="sm" />
            <span className="flex-1 min-w-0 truncate font-bold">{coupleName(r.members)}{r.me ? ' (you)' : ''}</span>
            <span className="font-display text-lg font-extrabold tabular-nums">{r.points}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
