import type { Board } from './api'
import { RecordsSections, Section, useRecords } from '../memories/Records'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { eyebrow } from '../ui/styles'

type Paired = Extract<Board, { state: 'paired' }>

// Opened from "More" on the Puzzles scoreboard: the daily puzzles' numbers, then your
// game-night records.
export function StatsPage({ d, onClose }: { d: Paired; onClose: () => void }) {
  const stats = d.stats ?? null
  const team = d.today.me + d.today.them
  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col enter-fallback">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 press">←</button>
        <div>
          <div className={eyebrow}>{d.me} & {d.partner}</div>
          <h1 className="font-display text-2xl font-extrabold leading-tight">Stats</h1>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8 pt-2 flex flex-col gap-5 w-full max-w-xl mx-auto">
        <Section title="Daily puzzles">
          <VsRow label="Today" me={d.today.me} them={d.today.them} partner={d.partner} />
          {stats && <VsRow label="This week" note="resets Monday" me={stats.week.me} them={stats.week.them} partner={d.partner} />}
          {stats && <VsRow label="Last week" me={stats.lastWeek.me} them={stats.lastWeek.them} partner={d.partner} />}
          <VsRow label="All time" me={d.total.me} them={d.total.them} partner={d.partner} />
        </Section>

        <Section title="Daily puzzles together 🤝">
          <Plain label="Together today" value={team} />
          {stats && <Plain label="Your best day" value={stats.bestDay || '—'} />}
          <Plain label="Streak" value={d.streak ? `${d.streak} ${d.streak === 1 ? 'day' : 'days'}` : '—'} />
          {stats && <Plain label="Played in the last 7 days" value={`${stats.daysLast7} of 7`} />}
        </Section>

        <ErrorBoundary quiet>
          <GameNights />
        </ErrorBoundary>
      </div>
    </div>
  )
}

function GameNights() {
  const { records, me, partner } = useRecords()
  if (!records) return null
  if (records.nights === 0) {
    return (
      <Section title="Game nights">
        <div className="py-2 text-sm text-fg/60">Play Today’s games together and your game-night records start here.</div>
      </Section>
    )
  }
  return <RecordsSections r={records} me={me} partner={partner} />
}

function VsRow({ label, note, me, them, partner }: { label: string; note?: string; me: number; them: number; partner: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex flex-col">
        <span className="font-bold text-fg/70">{label}</span>
        {note && <span className="text-xs text-fg/40">{note}</span>}
      </span>
      <span className="tabular-nums text-sm"><b className="text-pa-ink">You {me}</b> · <b className="text-pb-ink">{partner} {them}</b></span>
    </div>
  )
}

function Plain({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="font-bold text-fg/70">{label}</span>
      <span className="font-display text-xl font-extrabold tabular-nums text-tan-ink">{value}</span>
    </div>
  )
}
