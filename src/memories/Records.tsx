import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../daily/api'
import { localDate } from '../daily/dates'
import { useProfile } from '../profile/store'
import { useBackLayer } from '../ui/back'
import { Avatar } from '../ui/Avatar'
import { card, eyebrow } from '../ui/styles'
import { computeRecords, type Best, type Records } from './records'

// Your high scores: best nights together (Tonight and the full session kept apart —
// they're different lengths), the head-to-head, each game's best, and a couple of fun
// ones. A card at the top of Memories, opening the whole page.

function useRecords(): { records: Records | null; me: string; partner: string } {
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

export function RecordsCard() {
  const { records, me, partner } = useRecords()
  const [open, setOpen] = useState(false)
  useBackLayer(open, () => setOpen(false))
  if (!records || records.nights === 0) return null
  const r = records
  return (
    <>
      <button onClick={() => setOpen(true)} className={card + ' text-left px-4 py-4 flex flex-col gap-3 active:translate-y-px'}>
        <div className="flex items-center justify-between gap-3">
          <span className={eyebrow + ' text-accent-ink'}>🏆 Records</span>
          <span className="text-xs font-extrabold text-fg/50">See all ›</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Best Tonight" value={r.together.tonight?.value} tone="text-tan-ink" />
          <Stat label="Best full night" value={r.together.full?.value} tone="text-tan-ink" />
          <div className="flex flex-col items-center">
            <div className="font-display text-2xl font-extrabold tabular-nums">
              <span className="text-pa-ink">{r.wins.you}</span><span className="text-fg/25">–</span><span className="text-pb-ink">{r.wins.them}</span>
            </div>
            <div className="text-[0.65rem] font-extrabold uppercase tracking-wider text-fg/45">Nights won</div>
          </div>
        </div>
      </button>
      {open && createPortal(<RecordsPage r={r} me={me} partner={partner} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | undefined; tone: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={'font-display text-2xl font-extrabold tabular-nums ' + tone}>{value ?? '—'}</div>
      <div className="text-[0.65rem] font-extrabold uppercase tracking-wider text-fg/45">{label}</div>
    </div>
  )
}

function RecordsPage({ r, me, partner, onClose }: { r: Records; me: string; partner: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col animate-fade-up">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div>
          <div className={eyebrow}>{r.nights} {r.nights === 1 ? 'night' : 'nights'} played</div>
          <h1 className="font-display text-2xl font-extrabold leading-tight">Records</h1>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8 pt-2 flex flex-col gap-5 w-full max-w-xl mx-auto">
        <Section title="Together 🤝">
          <Row label="Best Tonight" best={r.together.tonight} />
          <Row label="Best full session" best={r.together.full} />
          <Row label="This week so far" best={{ value: r.together.thisWeek, on: '' }} />
        </Section>

        <Section title="Head to head">
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
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={card + ' px-4 py-3'}>
      <div className={eyebrow + ' mb-1'}>{title}</div>
      <div className="flex flex-col divide-y divide-fg/10">{children}</div>
    </section>
  )
}

function Row({ label, best, unit }: { label: string; best: Best; unit?: string }) {
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
