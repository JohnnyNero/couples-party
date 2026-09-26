import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, DailyError, type Memories } from '../daily/api'
import type { DialView, EitherView, NumbersView, PuzzleView, SketchView, Top5View } from '../daily/api'
import { sides } from '../daily/either'
import { localDate } from '../daily/dates'
import { questionFromThem } from '../daily/question'
import { parseSpectrumPrompt } from '../daily/dial'
import { DrawingCanvas } from '../views/DrawingCanvas'
import type { PlayerId } from '../engine/state'
import type { SessionMemory } from './summary'
import { Avatar, inkOf } from '../ui/Avatar'
import { card, eyebrow } from '../ui/styles'

// Everything you've played together, newest first: each night's session, and the daily
// puzzles under the day they were for. Nothing here is new data — the sessions are what
// the phones saved as you played (migration 0012), the puzzles are the daily ones, now
// with their answers showing.

type Paired = Extract<Memories, { state: 'paired' }>
type Puzzle = Paired['puzzles'][number]
type Status = { kind: 'loading' } | { kind: 'error'; error: DailyError } | { kind: 'ready'; data: Memories }

export function MemoriesTab() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [older, setOlder] = useState<Paired[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(() => {
    setStatus({ kind: 'loading' })
    setOlder([])
    api.memories(localDate())
      .then((data) => setStatus({ kind: 'ready', data }))
      .catch((e) => setStatus({ kind: 'error', error: e instanceof DailyError ? e : new DailyError("Couldn't reach the server.", 'offline') }))
  }, [])
  useEffect(load, [load])

  if (status.kind === 'loading') return <div className="h-40 grid place-items-center text-fg/30 animate-pulse">…</div>
  if (status.kind === 'error') {
    return (
      <Empty>
        {status.error.kind === 'setup'
          ? "Memories needs the latest database update (migration 0012)."
          : status.error.message}
        {status.error.kind !== 'setup' && (
          <button onClick={load} className="mt-3 block mx-auto text-sm uppercase tracking-widest text-accent-ink font-bold">Try again</button>
        )}
      </Empty>
    )
  }
  const d = status.data
  if (d.state !== 'paired') {
    return (
      <Empty>
        Pair your phones on the Today tab, and every night you play together is kept here — the
        answers, the drawings, the question you turned the light off on.
      </Empty>
    )
  }

  const pages = [d, ...older]
  const last = pages[pages.length - 1]
  const days = byDay(pages)
  const more = () => {
    setLoadingMore(true)
    api.memories(localDate(), last.since)
      .then((m) => { if (m.state === 'paired') setOlder((o) => [...o, m]) })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  return (
    <div className="flex flex-col gap-6 pt-1">
      {days.length === 0 && (
        <Empty>
          Nothing yet. Play Tonight together and it's kept here as you go; the daily puzzles
          join the day after.
        </Empty>
      )}
      {days.map(({ date, sessions, puzzles }) => (
        <section key={date} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className={eyebrow}>{longDate(date)}</span>
            <span className="flex-1 h-px bg-fg/10" />
          </div>
          {sessions.map((s) => <SessionCard key={s.key} m={s.payload as SessionMemory} />)}
          {puzzles.length > 0 && <PuzzlesCard puzzles={puzzles} me={d.me} partner={d.partner} />}
        </section>
      ))}
      <button
        onClick={more}
        disabled={loadingMore}
        className="self-center min-h-[44px] text-sm font-extrabold text-accent-ink disabled:opacity-40"
      >
        {loadingMore ? '…' : `Show before ${longDate(last.since, true)}`}
      </button>
    </div>
  )
}

function byDay(pages: Paired[]) {
  const map = new Map<string, { date: string; sessions: Paired['sessions']; puzzles: Puzzle[] }>()
  const day = (date: string) => {
    if (!map.has(date)) map.set(date, { date, sessions: [], puzzles: [] })
    return map.get(date)!
  }
  for (const p of pages) {
    for (const s of p.sessions) day(s.playedOn).sessions.push(s)
    for (const z of p.puzzles) day(z.forDate).puzzles.push(z)
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
}

function longDate(iso: string, short = false): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, short
    ? { day: 'numeric', month: 'long' }
    : { weekday: 'long', day: 'numeric', month: 'long' })
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl border-2 border-dashed border-fg/15 p-6 text-center text-sm text-fg/60 leading-relaxed">{children}</div>
}

// ---------------------------------------------------------------- a night's session

const SESSION_NAMES: Record<string, string> = { tonight: 'Tonight', full: 'The full session' }

function SessionCard({ m }: { m: SessionMemory }) {
  const [open, setOpen] = useState(false)
  const n = (p: PlayerId) => m.players[p]
  const lead = m.score.A === m.score.B ? null : m.score.A > m.score.B ? 'A' : 'B'
  return (
    <section className={card}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left px-5 py-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-display text-xl font-bold leading-tight">{SESSION_NAMES[m.game] ?? m.games[0]?.label ?? 'A session'}</div>
          <div className="text-sm text-fg/60 truncate">{m.games.map((g) => g.label).join(' · ')}</div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 tabular-nums" aria-label={`${n('A')} ${m.score.A}, ${n('B')} ${m.score.B}`}>
          <Avatar p="A" name={n('A')} size="sm" />
          <span className="font-display text-lg font-extrabold">
            <span className={lead === 'A' ? inkOf('A') : ''}>{m.score.A}</span>
            <span className="text-fg/30"> – </span>
            <span className={lead === 'B' ? inkOf('B') : ''}>{m.score.B}</span>
          </span>
          <Avatar p="B" name={n('B')} size="sm" />
        </div>
        <span className="shrink-0 text-fg/40 text-lg">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 animate-fade-up">
          {m.mrmrs && (
            <Part title="Mr & Mrs">
              {m.mrmrs.map((r, i) => (
                <div key={i} className="py-1.5 border-b border-fg/10 last:border-0">
                  <div className="text-sm text-fg/60">{r.question}</div>
                  {(['A', 'B'] as const).map((p) => (
                    <div key={p} className="text-sm">
                      <b className={inkOf(p)}>{n(p)}:</b> {r.answer[p] ?? '—'}
                      <span className="text-fg/45"> · {n(p === 'A' ? 'B' : 'A')} guessed "{r.predict[p === 'A' ? 'B' : 'A'] ?? '—'}" {r.verdict[p === 'A' ? 'B' : 'A'] ? '✓' : '✗'}</span>
                    </div>
                  ))}
                </div>
              ))}
            </Part>
          )}
          {m.draw && (
            <Part title="Drawings">
              <div className="grid grid-cols-2 gap-3">
                {m.draw.map((r, i) => (
                  <div key={i}>
                    <DrawingCanvas strokes={r.strokes} />
                    <div className="mt-1 text-xs text-fg/60 leading-snug">
                      {n(r.drawer)}'s {r.question}: <b className="text-fg">{r.answer ?? '—'}</b>
                      <br />guessed "{r.guess ?? '—'}" {r.correct ? '✓' : '✗'}
                    </div>
                  </div>
                ))}
              </div>
            </Part>
          )}
          {m.wave && (
            <Part title="Wavelength">
              {m.wave.map((r, i) => (
                <div key={i} className="text-sm py-1">
                  {r.low} ↔ {r.high}: <b>"{r.clue ?? '—'}"</b> from {n(r.psychic)}
                  <span className="text-fg/45"> · mark {r.target}, guessed {r.guess ?? '—'}</span>
                </div>
              ))}
            </Part>
          )}
          {m.shortlist && (
            <Part title="Shortlist">
              {m.shortlist.map((r, i) => (
                <div key={i} className="text-sm py-1">
                  <div className="text-fg/60">{r.theme}</div>
                  <div>{r.ranked.slice(0, 3).map((t, k) => `${k + 1}. ${t}`).join('  ')}</div>
                </div>
              ))}
            </Part>
          )}
          {m.clash && (
            <Part title="Category Clash">
              {m.clash.map((r, i) => (
                <div key={i} className="text-sm py-1">
                  <b className="text-accent-ink">{r.letter}</b>{' '}
                  {r.rows.map((row) => `${row.category}: ${row.answers.A || '—'} / ${row.answers.B || '—'}`).join(' · ')}
                </div>
              ))}
            </Part>
          )}
          {m.chain && (
            <Part title="Word Chain">
              {m.chain.map((r, i) => (
                <div key={i} className="text-sm py-1">
                  <span className="text-fg/60">{r.category}:</span> <span className="capitalize">{r.words.join(' → ')}</span>
                  {r.winner && <span className="text-fg/45"> · {n(r.winner)} won it</span>}
                </div>
              ))}
            </Part>
          )}
          {m.lights && (
            <Part title="Lights out">
              <div className="text-base italic">{m.lights}</div>
            </Part>
          )}
        </div>
      )}
    </section>
  )
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50 mb-1">{title}</div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------- a day's puzzles

const PUZZLE_NAMES: Record<Puzzle['kind'], string> = {
  word: 'Their Word', dial: 'The Dial', top5: 'Top 5', sketch: 'Sketch', numbers: 'Their Numbers', either: 'This or That',
}

function PuzzlesCard({ puzzles, me, partner }: { puzzles: Puzzle[]; me: string; partner: string }) {
  return (
    <section className="rounded-3xl border-2 border-fg/15 bg-card/50 px-5 py-4 flex flex-col divide-y divide-fg/10">
      {puzzles.map((p) => {
        // Set by one of you, for the other to solve.
        const setter = p.mine ? me : partner
        const solver = p.mine ? partner : me
        return (
          <div key={p.id} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display font-bold">{PUZZLE_NAMES[p.kind]}</span>
              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-fg/40">{setter} set it</span>
            </div>
            <div className="text-sm text-fg/80 mt-0.5">
              <PuzzleLine p={p} setter={setter} solver={solver} />
            </div>
          </div>
        )
      })}
    </section>
  )
}

function PuzzleLine({ p, setter, solver }: { p: Puzzle; setter: string; solver: string }) {
  const outcome = p.status === 'open' ? `${solver} never tried it` : null
  switch (p.kind) {
    case 'word': {
      const w = p as PuzzleView
      return (
        <>
          {questionFromThem(w.prompt, setter, solver)}: <b className="uppercase">{w.answer ?? '—'}</b>
          <span className="text-fg/45"> · {outcome ?? (w.status === 'solved' ? `${solver} got it in ${w.guesses.length}` : `${solver} didn't get it`)}</span>
        </>
      )
    }
    case 'dial': {
      const v = p as DialView
      const { low, high } = parseSpectrumPrompt(v.prompt)
      return (
        <>
          {low} ↔ {high}: <b>"{v.clue}"</b>
          <span className="text-fg/45"> · mark {v.target ?? '—'}{v.guess !== null ? `, ${solver} guessed ${v.guess}` : ` · ${outcome}`}</span>
        </>
      )
    }
    case 'top5': {
      const t = p as Top5View
      const order = t.rank?.map((i) => t.items[i]) ?? t.items
      return (
        <>
          {questionFromThem(t.prompt, setter, solver)}: <b>{order.map((x, k) => `${k + 1}. ${x}`).join('  ')}</b>
          <span className="text-fg/45"> · {outcome ?? `${solver} got ${t.exact ?? 0} exactly right`}</span>
        </>
      )
    }
    case 'sketch': {
      const k = p as SketchView
      return (
        <div className="flex gap-3 items-start">
          <div className="w-24 shrink-0"><DrawingCanvas strokes={k.strokes} /></div>
          <div>
            {setter}'s {k.prompt}: <b>{k.answer ?? '—'}</b>
            <div className="text-fg/45">{outcome ?? (k.status === 'solved' ? `${solver} got it` : `${solver} guessed ${k.guesses.map((g) => `"${g}"`).join(', ')}`)}</div>
          </div>
        </div>
      )
    }
    case 'numbers': {
      const nv = p as NumbersView
      return (
        <div className="flex flex-col">
          {nv.questions.map((q, i) => (
            <span key={i}>
              {questionFromThem(q, setter, solver)}: <b>{nv.answers?.[i] ?? '—'}</b>
              {nv.guesses && <span className="text-fg/45"> · guessed {nv.guesses[i]}</span>}
            </span>
          ))}
          {outcome && <span className="text-fg/45">{outcome}</span>}
        </div>
      )
    }
    case 'either': {
      const ev = p as EitherView
      const picks = ev.answers ? ev.questions.map((q, i) => sides(q)[ev.answers![i]]) : null
      return (
        <>
          {setter} picked <b>{picks ? picks.join(', ') : '—'}</b>
          <span className="text-fg/45"> · {outcome ?? `${solver} matched ${ev.matches ?? 0} of 5`}</span>
        </>
      )
    }
  }
}
