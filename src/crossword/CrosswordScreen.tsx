import { useMemo, useState } from 'react'
import { key, type Entry, type Puzzle } from './build'
import { along, entryAt, firstCursor, isFull, isSolved, nextClue, squaresOf, tap, type Cursor } from './grid'
import type { Ready } from './useCrossword'
import { MiniGrid } from './MiniGrid'
import { first, pct, type Side } from './standing'
import { LetterPad } from '../ui/keys'
import { Avatar } from '../ui/Avatar'
import { Shower, useFirstTime } from '../ui/fx'
import { buzz } from '../ui/haptics'
import { shareFiles } from '../share/shareFiles'
import { SITE } from '../share/card'
import { eyebrow } from '../ui/styles'

// Our crossword, open. The same grid and clues as your partner's, but this copy is yours:
// only your letters go in it. Above it, how far they've got with theirs (which squares,
// never the letters) — and once you've finished, their whole grid to look at. No hints
// and no checking — just the moment it's all right.

export function CrosswordScreen({ data, me, partner, week, onFill, onClose }: {
  data: Ready; me: string; partner: string; week: string; onFill: (changes: Record<string, string>) => void; onClose: () => void
}) {
  const p = data.puzzle
  const [cur, setCur] = useState<Cursor>(() => firstCursor(p))
  const [view, setView] = useState<'mine' | 'theirs'>('mine')
  const letterAt = (k: string) => data.cells[k]
  const entry = entryAt(p, cur.row, cur.col, cur.dir)
  const live = useMemo(() => new Set(entry ? squaresOf(entry).map(([r, c]) => key(r, c)) : []), [entry])
  const solved = !!data.solvedAt || isSolved(p, letterAt)
  const full = !solved && isFull(p, letterAt)
  const total = Object.keys(p.solution).length
  const mySide = { pct: pct(Object.keys(data.cells).length, total), solvedAt: data.solvedAt ?? (solved ? new Date().toISOString() : null) }
  const theirSide = { pct: pct(data.partner.filled.length, total), solvedAt: data.partner.solvedAt }
  const cheer = useFirstTime(solved ? `crossword-solved:${week}` : null)
  // Word that they've finished lands once, the first time you're here after it.
  const theyFinished = useFirstTime(data.partner.solvedAt ? `crossword-partner-done:${week}` : null)
  const size = Math.min(40, Math.floor((Math.min(window.innerWidth, 480) - 32) / p.w))
  const theirs = solved && view === 'theirs' && data.partner.cells
  // Check (only offered once every square's filled): the answers that aren't right, as
  // whole words — never which letter, never what it should be. Worked out as you go, so a
  // word you fix stops being marked.
  const [checked, setChecked] = useState(false)
  const wrong = useMemo(() => {
    if (!checked || solved) return [] as Entry[]
    return p.entries.filter((e) => {
      const sq = squaresOf(e).map(([r, c]) => key(r, c))
      return sq.every((k) => letterAt(k)) && sq.some((k) => letterAt(k) !== p.solution[k])
    })
  }, [checked, solved, p, data.cells]) // eslint-disable-line react-hooks/exhaustive-deps
  const wrongSquares = useMemo(() => new Set(wrong.flatMap((e) => squaresOf(e).map(([r, c]) => key(r, c)))), [wrong])

  const onKey = (k: string) => {
    if (solved) return
    if (k === 'Enter') { setCur(nextClue(p, cur, (x) => !!letterAt(x))); return }
    const here = key(cur.row, cur.col)
    if (k === 'Backspace') {
      if (letterAt(here)) onFill({ [here]: '' })
      else {
        const back = along(p, cur, -1)
        onFill({ [key(back.row, back.col)]: '' })
        setCur(back)
      }
      return
    }
    if (!/^[a-z]$/i.test(k)) return
    onFill({ [here]: k.toUpperCase() })
    const next = along(p, cur, 1)
    if (next.row === cur.row && next.col === cur.col) buzz('tap')
    setCur(next)
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <header className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 press">←</button>
        <div className="flex-1 min-w-0">
          <div className="font-display text-xl font-extrabold leading-tight">Our crossword</div>
          <div className="text-xs font-bold text-fg/55">Week of {weekLabel(week)} · {p.entries.length} clues</div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3">
        <Partner p={p} partner={partner} filled={data.partner.filled} side={theirSide} land={theyFinished} />
        {solved && data.partner.cells && (
          <div className="mt-3 flex justify-center">
            <div className="inline-flex rounded-full bg-fg/[0.07] p-1 text-sm font-extrabold">
              {(['mine', 'theirs'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={'press min-h-[36px] px-4 rounded-full ' + (view === v ? 'bg-card shadow-sm ' + (v === 'mine' ? 'text-pa-ink' : 'text-pb-ink') : 'text-fg/50')}>
                  {v === 'mine' ? 'Yours' : `${partner || 'Theirs'}’s`}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="relative mx-auto my-3" style={{ width: size * p.w, height: size * p.h }}>
          <Grid
            p={p}
            letters={theirs || data.cells}
            ink={theirs ? 'text-pb-ink' : 'text-fg'}
            size={size}
            cur={theirs ? null : cur}
            live={theirs ? new Set() : live}
            wrong={theirs ? new Set() : wrongSquares}
            onTap={(r, c) => { if (!theirs) setCur(tap(p, cur, r, c)) }}
          />
          {cheer && <Shower hearts delay={200} />}
        </div>
        {solved && (
          <section className="rounded-2xl bg-tan-soft text-tan-ink px-4 py-3 text-center animate-slam">
            <div className="font-display text-2xl font-extrabold">{theirSide.solvedAt ? 'You’ve both solved it ✓' : 'Solved ✓'}</div>
            <div className="text-sm font-bold opacity-75">{race(mySide, theirSide, partner)}</div>
            <button onClick={() => void shareFiles({ text: shareText(p, me, partner, week, mySide, theirSide), file: null, filename: '', title: 'Coupled' })} className="press mt-2 min-h-[44px] px-4 rounded-full bg-tan-ink text-tan-soft text-sm font-extrabold">
              Share our crossword
            </button>
          </section>
        )}
        {full && (
          <div className="rounded-2xl bg-fg/[0.06] px-4 py-3 text-center text-sm font-bold text-fg/70">
            {!checked ? (
              <>
                All filled in — but something’s not quite right.
                <button onClick={() => setChecked(true)} className="press mt-2 mx-auto block min-h-[40px] px-4 rounded-full border-2 border-fg/25 text-fg text-sm font-extrabold">
                  Check my answers
                </button>
              </>
            ) : wrong.length > 0 ? (
              <span className="text-pa-ink">{wrong.length === 1 ? 'One answer isn’t right' : `${wrong.length} answers aren’t right`} — marked in red.</span>
            ) : (
              'All filled in — but something’s not quite right.'
            )}
          </div>
        )}
        <Clues p={p} me={me} partner={partner} cur={cur} wrong={wrong} onPick={(e) => { setView('mine'); setCur({ row: e.row, col: e.col, dir: e.dir }) }} />
      </div>

      {!solved && (
        <div className="shrink-0 border-t border-fg/10 bg-bg px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex flex-col gap-2">
          {entry && <ClueBar e={entry} me={me} partner={partner} onPrev={() => setCur(nextClue(p, cur, (x) => !!letterAt(x), -1))} onNext={() => setCur(nextClue(p, cur, (x) => !!letterAt(x)))} />}
          <LetterPad onKey={onKey} />
        </div>
      )}
    </div>
  )
}

// Your partner's copy, small: the squares they've filled in their colour (never the
// letters), and where they are — "finished" landing with a stamp the first time you see it.
function Partner({ p, partner, filled, side, land }: { p: Puzzle; partner: string; filled: string[]; side: Side; land: boolean }) {
  const done = new Set(filled)
  return (
    <div className="mt-1 flex items-center gap-3 rounded-2xl bg-fg/[0.05] px-3 py-2.5">
      <MiniGrid w={p.w} h={p.h} squares={Object.keys(p.solution)} whose={(k) => (done.has(k) ? false : undefined)} size={44} />
      <div className="flex-1 min-w-0 text-sm font-bold leading-snug">
        {side.solvedAt ? (
          <span className={'inline-block text-pb-ink ' + (land ? 'animate-slam' : '')}>{partner || 'They'}’s solved theirs ✓</span>
        ) : side.pct === 0 ? (
          <span className="text-fg/55">{partner || 'They'} hasn’t started theirs yet</span>
        ) : (
          <span><span className="text-pb-ink">{partner || 'They'}</span> <span className="text-fg/60">is {side.pct}% through theirs</span></span>
        )}
      </div>
    </div>
  )
}

// Once you're done: who got there first.
function race(me: Side, them: Side, partner: string): string {
  const who = partner || 'They'
  const f = first(me, them)
  if (f === 'me') return `You got there first — ${dayOf(them.solvedAt!)} for ${who}`
  if (f === 'them') return `${who} got there first, ${dayOf(them.solvedAt!)}`
  if (them.pct === 0) return `${who} hasn’t started theirs yet`
  return `${who}’s ${them.pct}% through theirs`
}

const dayOf = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'today'
  return 'on ' + d.toLocaleDateString('en-GB', { weekday: 'long' })
}

function Grid({ p, letters, ink, size, cur, live, wrong, onTap }: {
  p: Puzzle; letters: Record<string, string>; ink: string; size: number; cur: Cursor | null; live: Set<string>; wrong: Set<string>; onTap: (r: number, c: number) => void
}) {
  const numbers = new Map(p.entries.map((e) => [key(e.row, e.col), e.n]))
  const out = []
  for (let r = 0; r < p.h; r++) {
    for (let c = 0; c < p.w; c++) {
      const k = key(r, c)
      if (!p.solution[k]) continue
      const l = letters[k]
      const here = cur?.row === r && cur?.col === c
      out.push(
        <button
          key={k}
          onClick={() => onTap(r, c)}
          className={'absolute border-2 border-fg flex items-center justify-center font-display font-extrabold ' +
            (here ? 'bg-accent/40' : wrong.has(k) ? 'bg-pa/25' : live.has(k) ? 'bg-accent/15' : 'bg-card')}
          style={{ left: c * size, top: r * size, width: size + 2, height: size + 2, fontSize: size * 0.58, marginLeft: -1, marginTop: -1 }}
          aria-label={`Square ${r + 1}, ${c + 1}${l ? `: ${l}` : ''}`}
        >
          {numbers.has(k) && <span className="absolute left-0.5 top-0 text-[0.55rem] leading-none font-bold text-fg/60" style={{ fontSize: Math.max(8, size * 0.26) }}>{numbers.get(k)}</span>}
          {l && <span className={'leading-none translate-y-[0.06em] ' + ink}>{l}</span>}
        </button>,
      )
    }
  }
  return <>{out}</>
}

// Whose clue it is: a little face for either of you, a book for general knowledge.
function Who({ who, me, partner }: { who: string | null; me: string; partner: string }) {
  if (who === null) {
    return (
      <span className="shrink-0 w-6 h-6 rounded-full bg-fg/[0.08] text-fg/55 inline-flex items-center justify-center" title="General knowledge">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></svg>
      </span>
    )
  }
  return <Avatar p={who === me ? 'A' : who === partner ? 'B' : 'A'} name={who} size="sm" className="shrink-0 !w-6 !h-6 !text-xs" />
}

function ClueBar({ e, me, partner, onPrev, onNext }: { e: Entry; me: string; partner: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-fg/[0.06] px-2 py-2">
      <button onClick={onPrev} aria-label="Previous clue" className="press w-9 h-9 shrink-0 rounded-full inline-flex items-center justify-center text-lg font-extrabold text-fg/60">‹</button>
      <Who who={e.who} me={me} partner={partner} />
      <div className="flex-1 min-w-0 text-sm font-bold leading-snug">
        <span className="font-extrabold text-accent-ink">{e.n} {e.dir === 'across' ? 'across' : 'down'}</span> · {e.clue} <span className="text-fg/50">({e.answer.length})</span>
      </div>
      <button onClick={onNext} aria-label="Next clue" className="press w-9 h-9 shrink-0 rounded-full inline-flex items-center justify-center text-lg font-extrabold text-fg/60">›</button>
    </div>
  )
}

function Clues({ p, me, partner, cur, wrong, onPick }: { p: Puzzle; me: string; partner: string; cur: Cursor; wrong: Entry[]; onPick: (e: Entry) => void }) {
  const on = entryAt(p, cur.row, cur.col, cur.dir)
  return (
    <div className="mt-4 grid grid-cols-1 gap-4">
      {(['across', 'down'] as const).map((dir) => (
        <section key={dir}>
          <div className={eyebrow + ' mb-1.5'}>{dir === 'across' ? 'Across' : 'Down'}</div>
          <div className="flex flex-col gap-1">
            {p.entries.filter((e) => e.dir === dir).map((e) => (
              <button key={`${dir}${e.n}`} onClick={() => onPick(e)} className={'text-left flex items-start gap-2 rounded-xl px-2 py-1.5 ' + (e === on ? 'bg-accent/15' : '')}>
                <span className="w-5 shrink-0 text-right text-sm font-extrabold text-fg/55">{e.n}</span>
                <Who who={e.who} me={me} partner={partner} />
                <span className="text-sm leading-snug">
                  {e.clue} <span className="text-fg/45">({e.answer.length})</span>
                  {wrong.includes(e) && <span className="ml-1.5 text-xs font-extrabold text-pa-ink">✗ not right</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export const weekLabel = (week: string) =>
  new Date(`${week}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// The finished grid to send: its shape, and how the two of you did — never the letters.
export function shareText(p: Puzzle, me: string, partner: string, week: string, mine: Side, theirs: Side): string {
  const rows: string[] = []
  for (let r = 0; r < p.h; r++) {
    let row = ''
    for (let c = 0; c < p.w; c++) row += p.solution[key(r, c)] ? '🟥' : '⬜'
    rows.push(row)
  }
  const f = first(mine, theirs)
  return [
    `Coupled · Our crossword, week of ${weekLabel(week)}`,
    ...rows,
    theirs.solvedAt
      ? `${me} ✓ · ${partner} ✓ — ${f === 'me' ? me : partner} got there first`
      : `${me} ✓ · ${partner} ${theirs.pct}%`,
    SITE,
  ].join('\n')
}
