import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../daily/api'
import { localDate } from '../daily/dates'
import { useProfile } from '../profile/store'
import { Avatar } from '../ui/Avatar'
import { card, eyebrow } from '../ui/styles'
import { computeRecords, type Best, type Records } from './records'

// Your game-night high scores: best nights together (Tonight and the full session kept
// apart — they're different lengths), the head-to-head, each game's best, and a couple
// of fun ones. Shown on the Stats page, under the daily puzzles' numbers.

export function useRecords(): { records: Records | null; me: string; partner: string } {
  const profile = useProfile()
  const paired = profile?.state === 'paired' ? profile : null
  const me = paired?.me.name ?? ''
  const [records, setRecords] = useState<Records | null>(null)
  useEffect(() => {
    if (!me) return
    api.records().then((rows) => setRecords(computeRecords(rows, me, localDate()))).catch(() => setRecords(null))
  }, [me])
  return { records, me, partner: paired?.partner.name ?? 'them' }
}

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

// The game-night records, as sections for the Stats page (see daily/StatsPage).
export function RecordsSections({ r, me, partner }: { r: Records; me: string; partner: string }) {
  return (
    <>
      <Section title="Game nights together 🤝">
        <Row label="Best Tonight" best={r.together.tonight} />
        <Row label="Best full session" best={r.together.full} />
        <Row label="This week so far" best={{ value: r.together.thisWeek, on: '' }} />
      </Section>

      <Section title="Game nights head to head">
        <div className="flex items-center justify-around py-2">
          {[{ p: 'A' as const, name: me, n: r.wins.you }, { p: 'B' as const, name: partner, n: r.wins.them }].map((x) => (
            <div key={x.p} className="flex flex-col items-center gap-1">
              <Avatar p={x.p} name={x.name} size="md" />
              <div className={'font-display text-4xl font-extrabold tabular-nums ' + (x.p === 'A' ? 'text-pa-ink' : 'text-pb-ink')}>{x.n}</div>
              <div className="text-xs font-bold text-fg/55">{x.p === 'A' ? 'You' : x.name}</div>
            </div>
          ))}
        </div>
        <div className="text-center text-xs font-bold text-fg/45">Nights won{r.wins.level ? ` · ${r.wins.level} level` : ''}</div>
        <Row label="Your best Tonight" best={r.bestNight.tonight.you} />
        <Row label={`${partner}’s best Tonight`} best={r.bestNight.tonight.them} />
        {(r.bestNight.full.you || r.bestNight.full.them) && (
          <>
            <Row label="Your best full session" best={r.bestNight.full.you} />
            <Row label={`${partner}’s best full session`} best={r.bestNight.full.them} />
          </>
        )}
      </Section>

      {r.games.length > 0 && (
        <Section title="Best in each game, together">
          {r.games.map((g) => <Row key={g.label} label={g.label} best={g.best} />)}
        </Section>
      )}

      {r.longestChain && (
        <Section title="Just for fun">
          <Row label="Longest Word Chain" best={r.longestChain} unit="words" />
        </Section>
      )}
    </>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={card + ' px-4 py-3'}>
      <div className={eyebrow + ' mb-1'}>{title}</div>
      <div className="flex flex-col divide-y divide-fg/10">{children}</div>
    </section>
  )
}

export function Row({ label, best, unit }: { label: string; best: Best; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="font-bold text-fg/70">{label}</span>
      <span className="flex items-baseline gap-2">
        {best?.on && <span className="text-xs font-bold text-fg/40">{shortDate(best.on)}</span>}
        <span className="font-display text-xl font-extrabold tabular-nums text-tan-ink">{best ? best.value : '—'}{unit && best ? ` ${unit}` : ''}</span>
      </span>
    </div>
  )
}
