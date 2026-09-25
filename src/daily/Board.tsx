import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Board as BoardData, BoardKinds } from './api'
import { Card } from './CardKit'
import { card } from '../ui/styles'
import { Avatar, inkOf } from '../ui/Avatar'
import { localDate } from './dates'
import { dialOfTheDay, spectrumPrompt } from './dial'
import { numbersOfTheDay } from './numbers'
import { PairStart, PairWaiting } from './Pairing'
import { PlayDial } from './PlayDial'
import { PlayNumbers } from './PlayNumbers'
import { PlaySketch } from './PlaySketch'
import { PlayTop5 } from './PlayTop5'
import { questionOfTheDay, renderQuestion } from './question'
import { SetDialClue } from './SetDialClue'
import { SetNumbers } from './SetNumbers'
import { SetSketch } from './SetSketch'
import { SetTop5 } from './SetTop5'
import { sketchOfTheDay } from './sketch'
import { TodayPuzzle } from './TodayPuzzle'
import { fiveify, itemsOfTheDay, themeOfTheDay } from './top5'
import { useBoard } from './useDaily'
import { WordAnswer } from './WordAnswer'
import { WordPlay } from './WordPlay'
import { loadNumberQuestions, loadPacks, loadWordPrompts } from '../packs'
import type { Content } from '../engine/state'

// The Today board: a scoreboard, then all five daily puzzles as tiles. Each tile is
// the same two steps — solve the one your partner set you for today, then set one for
// them for tomorrow. On day one (or a day they missed) there's nothing to solve, so the
// tile goes straight to setting.

type Kind = keyof BoardKinds
const KINDS: Kind[] = ['word', 'dial', 'top5', 'sketch', 'numbers']
const NAMES: Record<Kind, string> = {
  word: 'Their Word', dial: 'The Dial', top5: 'Top 5', sketch: 'Sketch', numbers: 'Their Numbers',
}

type Screen = { kind: Kind; mode: 'play' | 'set' }
type Pools = { content: Content; words: string[]; numbers: string[] }

export function Board({ board }: { board: ReturnType<typeof useBoard> }) {
  const [screen, setScreen] = useState<Screen | null>(null)
  // After closing a solve, open tomorrow's set straight away — but only once the fresh
  // board confirms the solve actually finished (backing out of a half-done Wordle
  // shouldn't push you on to setting).
  const [thenSet, setThenSet] = useState<{ kind: Kind; stale: unknown } | null>(null)
  const [pools, setPools] = useState<Pools | null>(null)
  useEffect(() => {
    void Promise.all([loadPacks(), loadWordPrompts(), loadNumberQuestions()])
      .then(([content, words, numbers]) => setPools({ content, words, numbers }))
  }, [])

  const { status, refresh } = board
  useEffect(() => {
    // `stale` is the board as it was when the solve closed — wait for the refetch.
    if (!thenSet || status === thenSet.stale) return
    if (status.kind !== 'ready' || status.data.state !== 'paired') return setThenSet(null)
    const k = status.data.kinds[thenSet.kind]
    if (k.solve && k.solve.status !== 'open' && !k.next) setScreen({ kind: thenSet.kind, mode: 'set' })
    setThenSet(null)
  }, [status, thenSet])

  if (status.kind === 'loading') {
    return <div className="h-40 grid place-items-center text-fg/30 animate-pulse">…</div>
  }
  if (status.kind === 'error') {
    // The server doesn't have board() yet (migration 0010) — the one-a-day slot still works.
    if (status.error.kind === 'setup') return <TodayPuzzle />
    return (
      <Card title="Today">
        <div className="text-sm text-fg/60">{status.error.message}</div>
        <button onClick={() => void refresh()} className="mt-3 text-sm uppercase tracking-widest text-accent-ink font-bold">
          Try again
        </button>
      </Card>
    )
  }

  const d = status.data
  if (d.state === 'single') {
    return (
      <Card title="Pair up" sub="Daily puzzles for two">
        <p className="text-sm text-fg/60 mb-4">
          Link your two phones once. Then every day there are five puzzles your partner set
          for you — solve them, then set theirs for tomorrow.
        </p>
        <PairStart onDone={() => void refresh()} />
      </Card>
    )
  }
  if (d.state === 'waiting') {
    return <Card title="Pair your phones"><PairWaiting code={d.code} onCancel={() => void refresh()} /></Card>
  }

  const close = (then?: Kind) => {
    setScreen(null)
    if (then) setThenSet({ kind: then, stale: status })
    void refresh()
  }

  return (
    <>
      {/* Into <body>, not here: the tab's fade-in leaves a transform on an ancestor,
          and a transformed ancestor traps position: fixed inside itself. */}
      {screen && pools && createPortal(
        <div className="fixed inset-0 z-50 bg-bg">
          <PuzzleScreen
            screen={screen}
            data={d}
            pools={pools}
            onClose={() => close(screen.mode === 'play' ? screen.kind : undefined)}
          />
        </div>,
        document.body,
      )}
      <div className="flex flex-col gap-3">
        <Scoreboard d={d} />
        <div className="grid grid-cols-2 gap-3">
          {KINDS.map((k, i) => (
            <Tile
              key={k}
              kind={k}
              partner={d.partner}
              slot={d.kinds[k]}
              wide={i === KINDS.length - 1}
              onOpen={(mode) => setScreen({ kind: k, mode })}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- scoreboard

// You against them, all-time, with today's haul under each — and the day's five as a
// strip of pips.
function Scoreboard({ d }: { d: Extract<BoardData, { state: 'paired' }> }) {
  const played = KINDS.map((k) => {
    const s = d.kinds[k].solve
    return !!s && s.status !== 'open'
  })
  const done = played.filter(Boolean).length
  const lead = d.total.me === d.total.them ? null : d.total.me > d.total.them ? 'A' : 'B'
  return (
    <section className={card + ' px-4 py-4 flex flex-col gap-3'}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-display text-[1.05rem] font-bold">Today's puzzles</div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {played.map((p, i) => (
              <span key={i} className={'h-2 w-5 rounded-full ' + (p ? 'bg-fg' : 'bg-fg/15')} />
            ))}
          </div>
          <span className="text-xs font-bold text-fg/55 tabular-nums">{done} of 5</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Side p="A" name={d.me} label="You" today={d.today.me} total={d.total.me} lead={lead === 'A'} />
        <span className="font-display font-bold text-sm text-fg/30">vs</span>
        <Side p="B" name={d.partner} label={d.partner} today={d.today.them} total={d.total.them} lead={lead === 'B'} flip />
      </div>
    </section>
  )
}

function Side({ p, name, label, today, total, lead, flip = false }: {
  p: 'A' | 'B'; name: string; label: string; today: number; total: number; lead: boolean; flip?: boolean
}) {
  return (
    <div className={'flex-1 min-w-0 flex items-center gap-2.5 ' + (flip ? 'flex-row-reverse text-right' : '')}>
      <Avatar p={p} name={name} />
      <div className="min-w-0">
        <div className="text-xs font-bold text-fg/60 truncate">
          {lead && <span aria-label="leading">👑 </span>}{label} · +{today} today
        </div>
        <div className={'font-display text-[1.75rem] font-extrabold leading-none tabular-nums ' + inkOf(p)}>{total}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- tiles

type Slot = BoardKinds[Kind]

function Tile({
  kind,
  partner,
  slot,
  wide,
  onOpen,
}: {
  kind: Kind
  partner: string
  slot: Slot
  wide: boolean
  onOpen: (mode: 'play' | 'set') => void
}) {
  const { solve, mine, next } = slot
  const started = !!solve && 'guesses' in solve && Array.isArray(solve.guesses) && solve.guesses.length > 0
  const solved = !!solve && solve.status !== 'open'
  const complete = (solved || !solve) && !!next

  // What the tile asks of you, as a chip: something to play (filled), something to set
  // for them (outlined), or nothing left (quiet).
  let chip: ReactNode
  let mode: 'play' | 'set'
  if (solve && !solved) {
    chip = <span className="px-2.5 py-1 rounded-full bg-pa text-white text-xs font-extrabold">{started ? 'Carry on' : 'Play'}</span>
    mode = 'play'
  } else if (!next) {
    // Nothing set for today yet (day one, or a missed day) → set one for today, so
    // there's something to play right away, instead of only ever setting for tomorrow.
    const what = !mine ? `Set ${partner}'s for today` : solved ? `Now set ${partner}'s` : `Set ${partner}'s`
    chip = <span className="px-2.5 py-1 rounded-full border-2 border-fg/25 text-xs font-extrabold truncate max-w-full">{what}</span>
    mode = 'set'
  } else {
    chip = (
      <span className="text-xs font-extrabold text-fg/50">
        {solved ? <>Done · <span className="text-accent-ink">+{solve!.points ?? 0}</span></> : 'Sent ✓'}
      </span>
    )
    mode = solved ? 'play' : 'set'
  }

  return (
    <button
      onClick={() => onOpen(mode)}
      className={
        'text-left rounded-[1.25rem] border-2 px-3.5 py-3 active:translate-y-px transition-colors flex ' +
        (wide ? 'col-span-2 items-center gap-3 ' : 'flex-col gap-2.5 ') +
        (complete ? 'border-fg/15 bg-fg/[0.03]' : 'border-fg bg-card shadow-[3px_3px_0_rgba(0,0,0,0.12)]')
      }
    >
      <div className={'flex items-center gap-2 min-w-0 ' + (wide ? 'flex-1' : '')}>
        <span className="shrink-0 w-8 h-8 rounded-[10px] bg-fg/[0.05] inline-flex items-center justify-center"><KindIcon kind={kind} /></span>
        <span className="flex-1 min-w-0 font-display text-base font-bold leading-tight truncate">{NAMES[kind]}</span>
      </div>
      <div className={wide ? 'shrink-0' : 'self-start max-w-full'}>{chip}</div>
    </button>
  )
}

function KindIcon({ kind }: { kind: Kind }) {
  const box = 'w-6 h-6 shrink-0'
  switch (kind) {
    case 'word':
      return (
        <svg viewBox="0 0 24 24" className={box} aria-hidden="true">
          <rect x="2" y="2" width="9" height="9" rx="2" fill="rgb(var(--correct))" />
          <rect x="13" y="2" width="9" height="9" rx="2" fill="rgb(var(--present))" />
          <rect x="2" y="13" width="9" height="9" rx="2" fill="rgb(var(--absent))" />
          <rect x="13" y="13" width="9" height="9" rx="2" fill="rgb(var(--correct))" />
        </svg>
      )
    case 'dial':
      return (
        <svg viewBox="0 0 24 24" className={box} aria-hidden="true">
          <path d="M3 17a9 9 0 0 1 18 0z" fill="rgb(var(--accent) / 0.2)" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 17 16.5 9.5" stroke="rgb(var(--fg))" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'top5':
      return (
        <svg viewBox="0 0 24 24" className={box} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="3" y={2.5 + i * 4} width={18 - i * 3} height="3" rx="1.5" fill={i === 0 ? 'rgb(var(--accent))' : 'rgb(var(--fg) / 0.35)'} />
          ))}
        </svg>
      )
    case 'sketch':
      return (
        <svg viewBox="0 0 24 24" className={box} aria-hidden="true" fill="none">
          <path d="m15 4 5 5L9 20H4v-5z" fill="rgb(var(--present) / 0.35)" stroke="rgb(var(--fg))" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m13 6 5 5" stroke="rgb(var(--fg))" strokeWidth="1.8" />
        </svg>
      )
    case 'numbers':
      return (
        <svg viewBox="0 0 24 24" className={box} aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="rgb(var(--accent))" />
          <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="rgb(var(--bg))" fontFamily="Nunito, Arial">123</text>
        </svg>
      )
  }
}

// ---------------------------------------------------------------- screens

// Solve screens show the puzzle as stored. Set screens work out tomorrow's question the
// same way both phones do, unless one's already been set (then it's changing that one —
// and the server keeps you both on the same question either way).
function PuzzleScreen({
  screen,
  data,
  pools,
  onClose,
}: {
  screen: Screen
  data: Extract<BoardData, { state: 'paired' }>
  pools: Pools
  onClose: () => void
}) {
  const { partner, me, kinds } = data
  const tomorrow = localDate(1)

  // Setting for tomorrow is the normal flow — but if nothing's been set for today at
  // all yet (day one, or a day you both missed), set that one for today instead, so
  // there's something to play right away. `undefined` here means "today" to every Set…
  // component below (see e.g. SetDialClue's `forDate` prop).
  const setDate = (k: Kind): string | undefined => (kinds[k].mine ? tomorrow : undefined)

  if (screen.mode === 'play') {
    switch (screen.kind) {
      case 'word': {
        const p = kinds.word.solve!
        return <WordPlay puzzle={p} partner={partner} question={renderQuestion(p.prompt, me)} mine={kinds.word.mine?.answer ?? null} onClose={onClose} />
      }
      case 'dial': return <PlayDial puzzle={kinds.dial.solve!} partner={partner} spectrum={kinds.dial.solve!.prompt} onClose={onClose} />
      case 'top5': return <PlayTop5 puzzle={kinds.top5.solve!} partner={partner} theme={kinds.top5.solve!.prompt} onClose={onClose} />
      case 'sketch': return <PlaySketch puzzle={kinds.sketch.solve!} partner={partner} prompt={kinds.sketch.solve!.prompt} onClose={onClose} />
      case 'numbers': return <PlayNumbers puzzle={kinds.numbers.solve!} partner={partner} onClose={onClose} />
    }
  }

  switch (screen.kind) {
    case 'word': {
      const date = setDate('word')
      const template = kinds.word.next?.prompt ?? questionOfTheDay(date ?? localDate(), pools.words) ?? ''
      return <WordAnswer partner={partner} template={template} question={renderQuestion(template, partner)} onClose={onClose} forDate={date} />
    }
    case 'dial': {
      const date = setDate('dial')
      const picked = dialOfTheDay(date ?? localDate(), pools.content.spectrums)
      const spectrum = kinds.dial.next?.prompt ?? (picked ? spectrumPrompt(picked) : 'Cold | Hot')
      return <SetDialClue partner={partner} spectrum={spectrum} onClose={onClose} forDate={date} />
    }
    case 'top5': {
      const date = setDate('top5')
      const next = kinds.top5.next
      const theme = themeOfTheDay(date ?? localDate(), pools.content.themes)
      const title = next?.prompt ?? (theme ? fiveify(renderQuestion(theme.text, partner)) : '')
      const items = next?.items ?? (theme ? itemsOfTheDay(date ?? localDate(), theme) : [])
      return <SetTop5 partner={partner} theme={title} items={items} onClose={onClose} forDate={date} />
    }
    case 'sketch': {
      const date = setDate('sketch')
      const prompt = kinds.sketch.next?.prompt ?? sketchOfTheDay(date ?? localDate(), pools.content.drawPrompts) ?? 'comfort food'
      return <SetSketch partner={partner} prompt={prompt} onClose={onClose} forDate={date} />
    }
    case 'numbers': {
      const date = setDate('numbers')
      const questions = kinds.numbers.next?.questions ?? numbersOfTheDay(date ?? localDate(), pools.numbers) ?? []
      return <SetNumbers partner={partner} questions={questions} onClose={onClose} forDate={date} />
    }
  }
}
