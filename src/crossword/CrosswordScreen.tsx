import { useMemo, useState } from 'react'
import { key, type Entry, type Puzzle } from './build'
import { along, entryAt, firstCursor, isFull, isSolved, nextClue, squaresOf, tap, type Cursor } from './grid'
import type { Ready } from './useCrossword'
import { Keyboard } from '../daily/Tiles'
import { Avatar } from '../ui/Avatar'
import { Shower, useFirstTime } from '../ui/fx'
import { buzz } from '../ui/haptics'
import { shareFiles } from '../share/shareFiles'
import { SITE } from '../share/card'
import { eyebrow } from '../ui/styles'

// Our crossword, open. One grid for the two of you: your letters in your colour (coral),
// theirs in theirs (blue), and theirs turn up as they type. No hints and no checking —
// just the moment it's all right.

export function CrosswordScreen({ data, me, partner, week, onFill, onClose, onRebuild }: {
  data: Ready; me: string; partner: string; week: string; onFill: (changes: Record<string, string>) => void; onClose: () => void; onRebuild?: () => void
}) {
  const p = data.puzzle
  const [cur, setCur] = useState<Cursor>(() => firstCursor(p))
  const letterAt = (k: string) => data.cells[k]?.l
  const entry = entryAt(p, cur.row, cur.col, cur.dir)
  const live = useMemo(() => new Set(entry ? squaresOf(entry).map(([r, c]) => key(r, c)) : []), [entry])
  const solved = !!data.solvedAt || isSolved(p, letterAt)
  const full = !solved && isFull(p, letterAt)
  const cheer = useFirstTime(solved ? `crossword-solved:${week}` : null)
  const size = Math.min(40, Math.floor((Math.min(window.innerWidth, 480) - 32) / p.w))

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
        <Legend me={me} partner={partner} />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3">
        <div className="relative mx-auto my-3" style={{ width: size * p.w, height: size * p.h }}>
          <Grid p={p} data={data} size={size} cur={cur} live={live} onTap={(r, c) => setCur(tap(p, cur, r, c))} />
          {cheer && <Shower hearts delay={200} />}
        </div>
        {solved && (
          <section className="rounded-2xl bg-tan-soft text-tan-ink px-4 py-3 text-center animate-slam">
            <div className="font-display text-2xl font-extrabold">Solved together ✓</div>
            <div className="text-sm font-bold opacity-75">A new one on Monday</div>
            <button onClick={() => void shareFiles({ text: shareText(p, data, me, partner, week), file: null, filename: '', title: 'Coupled' })} className="press mt-2 min-h-[44px] px-4 rounded-full bg-tan-ink text-tan-soft text-sm font-extrabold">
              Share our crossword
            </button>
          </section>
        )}
        {full && (
          <div className="rounded-2xl bg-fg/[0.06] px-4 py-3 text-center text-sm font-bold text-fg/70">
            All filled in — but something’s not quite right.
          </div>
        )}
        <Clues p={p} me={me} partner={partner} cur={cur} onPick={(e) => setCur({ row: e.row, col: e.col, dir: e.dir })} />
        {onRebuild && <Rebuild onRebuild={onRebuild} />}
      </div>

      {!solved && (
        <div className="shrink-0 border-t border-fg/10 bg-bg px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex flex-col gap-2">
          {entry && <ClueBar e={entry} me={me} partner={partner} onPrev={() => setCur(nextClue(p, cur, (x) => !!letterAt(x), -1))} onNext={() => setCur(nextClue(p, cur, (x) => !!letterAt(x)))} />}
          <Keyboard onKey={onKey} />
        </div>
      )}
    </div>
  )
}

// For testing: build this week's again from your answers as they are now. Asks first —
// it clears both of your letters.
function Rebuild({ onRebuild }: { onRebuild: () => void }) {
  const [sure, setSure] = useState(false)
  return (
    <div className="mt-8 mb-2 flex flex-col items-center gap-2">
      <button
        onClick={() => (sure ? onRebuild() : setSure(true))}
        className={'press min-h-[40px] px-4 rounded-full border-2 text-xs font-extrabold ' + (sure ? 'border-pa text-pa-ink' : 'border-fg/15 text-fg/50')}
      >
        {sure ? 'Tap again: clears both of your letters' : 'Testing: rebuild this week’s crossword'}
      </button>
    </div>
  )
}

function Grid({ p, data, size, cur, live, onTap }: { p: Puzzle; data: Ready; size: number; cur: Cursor; live: Set<string>; onTap: (r: number, c: number) => void }) {
  const numbers = new Map(p.entries.map((e) => [key(e.row, e.col), e.n]))
  const out = []
  for (let r = 0; r < p.h; r++) {
    for (let c = 0; c < p.w; c++) {
      const k = key(r, c)
      if (!p.solution[k]) continue
      const cell = data.cells[k]
      const here = cur.row === r && cur.col === c
      out.push(
        <button
          key={k}
          onClick={() => onTap(r, c)}
          className={'absolute border-2 border-fg flex items-center justify-center font-display font-extrabold ' +
            (here ? 'bg-accent/40' : live.has(k) ? 'bg-accent/15' : 'bg-card')}
          style={{ left: c * size, top: r * size, width: size + 2, height: size + 2, fontSize: size * 0.58, marginLeft: -1, marginTop: -1 }}
          aria-label={`Square ${r + 1}, ${c + 1}${cell ? `: ${cell.l}` : ''}`}
        >
          {numbers.has(k) && <span className="absolute left-0.5 top-0 text-[0.55rem] leading-none font-bold text-fg/60" style={{ fontSize: Math.max(8, size * 0.26) }}>{numbers.get(k)}</span>}
          {cell && <span className={'leading-none translate-y-[0.06em] ' + (cell.mine ? 'text-pa-ink' : 'text-pb-ink')}>{cell.l}</span>}
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

function Clues({ p, me, partner, cur, onPick }: { p: Puzzle; me: string; partner: string; cur: Cursor; onPick: (e: Entry) => void }) {
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
                <span className="text-sm leading-snug">{e.clue} <span className="text-fg/45">({e.answer.length})</span></span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function Legend({ me, partner }: { me: string; partner: string }) {
  return (
    <div className="shrink-0 flex flex-col items-end text-[0.65rem] font-extrabold leading-tight">
      <span className="text-pa-ink">■ {me || 'You'}</span>
      <span className="text-pb-ink">■ {partner || 'Them'}</span>
    </div>
  )
}

export const weekLabel = (week: string) =>
  new Date(`${week}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// The finished grid to send: who filled each square, in your colours — nothing more.
export function shareText(p: Puzzle, data: Ready, me: string, partner: string, week: string): string {
  let mine = 0
  let theirs = 0
  const rows: string[] = []
  for (let r = 0; r < p.h; r++) {
    let row = ''
    for (let c = 0; c < p.w; c++) {
      const cell = data.cells[key(r, c)]
      if (!p.solution[key(r, c)]) row += '⬛'
      else if (cell?.mine) { row += '🟥'; mine++ }
      else if (cell) { row += '🟦'; theirs++ }
      else row += '⬜'
    }
    rows.push(row)
  }
  return [
    `Coupled · Our crossword, week of ${weekLabel(week)}`,
    'Solved together ✓',
    ...rows,
    `🟥 ${me} ${mine} · 🟦 ${partner} ${theirs}`,
    SITE,
  ].join('\n')
}
