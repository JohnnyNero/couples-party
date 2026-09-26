import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Board as BoardData, BoardKinds } from './api'
import { Card } from './CardKit'
import { card } from '../ui/styles'
import { Avatar, inkOf } from '../ui/Avatar'
import { localDate } from './dates'
import { dialOfTheDay, spectrumPrompt } from './dial'
import { numbersOfTheDay } from './numbers'
import { eitherOfTheDay } from './either'
import { PairStart, PairWaiting } from './Pairing'
import { PlayDial } from './PlayDial'
import { PlayEither } from './PlayEither'
import { PlayNumbers } from './PlayNumbers'
import { PlaySketch } from './PlaySketch'
import { PlayTop5 } from './PlayTop5'
import { questionFromThem, questionOfTheDay, renderQuestion } from './question'
import { say } from '../say'
import { useIdeas } from '../ideas/store'
import { TheirGo, TheirGoButton } from './TheirGo'
import { refreshProfile } from '../profile/store'
import { api } from './api'
import { useBackLayer } from '../ui/back'
import { caughtUpOn, markCaughtUp, settle, type Pin } from './pins'
import { SetDialClue } from './SetDialClue'
import { SetEither } from './SetEither'
import { SetNumbers } from './SetNumbers'
import { SetSketch } from './SetSketch'
import { SetTop5 } from './SetTop5'
import { sketchOfTheDay } from './sketch'
import { TodayPuzzle } from './TodayPuzzle'
import { fiveify, itemsOfTheDay, themeOfTheDay } from './top5'
import { useBoard } from './useDaily'
import { WordAnswer } from './WordAnswer'
import { WordPlay } from './WordPlay'
import { loadEitherPairs, loadNumberQuestions, loadPacks, loadWordPrompts } from '../packs'
import type { Content } from '../engine/state'

// The Today board: a scoreboard, then all six daily puzzles as tiles. Each tile is
// the same two steps — solve the one your partner set you for today, then set one for
// them for tomorrow. On day one (or a day they missed) there's nothing to solve, so the
// tile goes straight to setting.

type Kind = keyof BoardKinds
const KINDS: Kind[] = ['word', 'dial', 'top5', 'sketch', 'numbers', 'either']
const NAMES: Record<Kind, string> = {
  word: 'Their Word', dial: 'The Dial', top5: 'Top 5', sketch: 'Sketch', numbers: 'Their Numbers', either: 'This or That',
}
// The kinds this server knows — This or That needs migration 0017.
const kindsOf = (d: { kinds: BoardKinds }) => KINDS.filter((k) => d.kinds[k])

// 'theirs': how your partner did on the one you set them today (TheirGo).
type Screen = { kind: Kind; mode: 'play' | 'set' | 'theirs' }
type Pools = { content: Content; words: string[]; numbers: string[]; either: string[] }

export function Board({ board }: { board: ReturnType<typeof useBoard> }) {
  const [screen, setScreen] = useState<Screen | null>(null)
  // Just closed a puzzle: until the board has caught up, the tiles still show how things
  // were before (a "Play" on something you've just finished). They don't open till then.
  const [syncing, setSyncing] = useState(false)
  const [pools, setPools] = useState<Pools | null>(null)
  useEffect(() => {
    void Promise.all([loadPacks(), loadWordPrompts(), loadNumberQuestions(), loadEitherPairs()])
      .then(([content, words, numbers, either]) => setPools({ content, words, numbers, either }))
  }, [])

  const { status, refresh } = board
  // Back from a puzzle, or from setting one, is the board.
  const closeScreen = () => {
    setScreen(null)
    setSyncing(true)
    void refresh().finally(() => setSyncing(false))
  }
  useBackLayer(screen !== null, closeScreen)
  // Pairing (or unpairing) shows up here first, on the poll — let the profile, and so
  // every avatar and the header, catch up straight away.
  const pairState = status.kind === 'ready' ? status.data.state : null
  useEffect(() => { if (pairState) void refreshProfile() }, [pairState])

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
          Link your two phones once. Then every day there are six puzzles your partner set
          for you — solve them, then set theirs for tomorrow.
        </p>
        <PairStart onDone={() => void refresh()} />
      </Card>
    )
  }
  if (d.state === 'waiting') {
    return <Card title="Pair your phones"><PairWaiting code={d.code} me={d.me} onCancel={() => void refresh()} /></Card>
  }

  // Setting the next one is a button under your result now (see PuzzleScreen), so
  // closing just closes.
  const kinds = kindsOf(d)
  const close = closeScreen

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
            onClose={close}
            onSwitch={setScreen}
          />
        </div>,
        document.body,
      )}
      <div className="flex flex-col gap-3">
        <Scoreboard d={d} />
        <div className="grid grid-cols-2 gap-3">
          {kinds.map((k, i) => (
            <Tile
              key={k}
              kind={k}
              partner={d.partner}
              slot={d.kinds[k]!}
              wide={kinds.length % 2 === 1 && i === kinds.length - 1}
              caught={caughtUpOn(localDate(), k)}
              onOpen={(mode) => { if (!syncing) setScreen({ kind: k, mode }) }}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- scoreboard

// Today's head-to-head, with the team total beside it: the two of you added together,
// against your best day as a couple. The crown is this week's — it goes to whoever's
// ahead since Monday and resets every Monday. All-time and last week are one tap deeper.
function Scoreboard({ d }: { d: Extract<BoardData, { state: 'paired' }> }) {
  const [open, setOpen] = useState(false)
  const kinds = kindsOf(d)
  const played = kinds.map((k) => {
    const s = d.kinds[k]!.solve
    return !!s && s.status !== 'open'
  })
  const done = played.filter(Boolean).length
  const stats = d.stats ?? null
  const week = stats?.week ?? null
  const crown = !week || week.me === week.them ? null : week.me > week.them ? 'A' : 'B'
  const team = d.today.me + d.today.them
  const best = stats?.bestDay ?? 0
  const newBest = stats !== null && best > 0 && team > best

  return (
    <section className={card + ' px-4 py-4 flex flex-col gap-3'}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-display text-[1.05rem] font-bold whitespace-nowrap">Today</div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {played.map((p, i) => (
              <span key={i} className={'h-2 w-3.5 min-[400px]:w-5 rounded-full ' + (p ? 'bg-fg' : 'bg-fg/15')} />
            ))}
          </div>
          <span className="text-xs font-bold text-fg/55 tabular-nums whitespace-nowrap">{done} of {kinds.length}</span>
        </div>
      </div>

      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2 text-left">
        <Side p="A" name={d.me} label="You" points={d.today.me} crown={crown === 'A'} />
        <span className="font-display font-bold text-sm text-fg/30">vs</span>
        <Side p="B" name={d.partner} label={d.partner} points={d.today.them} crown={crown === 'B'} flip />
      </button>

      {stats && (
        <div className="flex items-center gap-3 rounded-2xl bg-tan-soft text-tan-ink px-3.5 py-2.5">
          <span className="text-lg" aria-hidden="true">🤝</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-extrabold">Together today</div>
            <div className="text-xs font-bold opacity-75">
              {newBest ? 'A new best day!' : best > 0 ? `Your best day: ${best}` : 'Your first day together counts'}
            </div>
          </div>
          <span className="font-display text-2xl font-extrabold tabular-nums">{team}</span>
        </div>
      )}

      {stats && (
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-left text-xs font-bold text-fg/55 flex items-center justify-between gap-2">
          <span className="truncate">
            {crown
              ? <>👑 {crown === 'A' ? 'You’re' : `${d.partner}’s`} ahead this week, {Math.max(week!.me, week!.them)}–{Math.min(week!.me, week!.them)}</>
              : week && week.me + week.them > 0 ? <>Level this week, {week.me}–{week.them}</> : 'A new week — the crown’s up for grabs'}
          </span>
          <span className="shrink-0">{open ? 'Less' : 'More'} ›</span>
        </button>
      )}

      {open && (
        <div className="rounded-2xl bg-fg/[0.04] px-3.5 py-3 text-sm flex flex-col gap-1.5 animate-fade-up">
          <Line label="This week" me={week?.me ?? 0} them={week?.them ?? 0} partner={d.partner} note="resets Monday" />
          {stats && <Line label="Last week" me={stats.lastWeek.me} them={stats.lastWeek.them} partner={d.partner} />}
          <Line label="All time" me={d.total.me} them={d.total.them} partner={d.partner} />
        </div>
      )}
    </section>
  )
}

function Line({ label, me, them, partner, note }: { label: string; me: number; them: number; partner: string; note?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 flex flex-col">
        <span className="font-bold text-fg/60">{label}</span>
        {note && <span className="text-xs text-fg/40">{note}</span>}
      </span>
      <span className="tabular-nums"><b className="text-pa-ink">You {me}</b> · <b className="text-pb-ink">{partner} {them}</b></span>
    </div>
  )
}

function Side({ p, name, label, points, crown, flip = false }: {
  p: 'A' | 'B'; name: string; label: string; points: number; crown: boolean; flip?: boolean
}) {
  return (
    <div className={'flex-1 min-w-0 flex items-center gap-2.5 ' + (flip ? 'flex-row-reverse text-right' : '')}>
      <Avatar p={p} name={name} />
      <div className="min-w-0">
        <div className="text-xs font-bold text-fg/60 truncate">
          {crown && <span aria-label="ahead this week">👑 </span>}{label}
        </div>
        <div className={'font-display text-[1.75rem] font-extrabold leading-none tabular-nums ' + inkOf(p)}>{points}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- tiles

type Slot = NonNullable<BoardKinds[Kind]>

function Tile({
  kind,
  partner,
  slot,
  wide,
  caught,
  onOpen,
}: {
  kind: Kind
  partner: string
  slot: Slot
  wide: boolean
  caught: boolean // you set theirs for today, today (see markCaughtUp)
  onOpen: (mode: Screen['mode']) => void
}) {
  const { solve, mine, next } = slot
  const started = !!solve && 'guesses' in solve && Array.isArray(solve.guesses) && solve.guesses.length > 0
  const solved = !!solve && solve.status !== 'open'
  // Set theirs for today (day one, or a day they missed): that was your one for the day.
  // Tomorrow's is set tomorrow — never a second straight after the first.
  const caughtUp = caught && !!mine && !next
  const complete = ((solved || !solve) && !!next) || (caughtUp && (!solve || solved))

  // What the tile asks of you, as a chip: something to play (filled), something to set
  // for them (outlined), or nothing left (quiet).
  let chip: ReactNode
  // null: nothing to do here — you've set theirs and there's nothing of yours to see yet.
  // A set puzzle is never reopened to change; a finished one only ever shows its result.
  let mode: Screen['mode'] | null
  if (solve && !solved) {
    chip = <span className="px-2.5 py-1 rounded-full bg-pa text-white text-xs font-extrabold">{started ? 'Carry on' : 'Play'}</span>
    mode = 'play'
  } else if (caughtUp) {
    if (solved) {
      // Your result, where the button is their go.
      chip = <span className="text-xs font-extrabold text-fg/50">Done · <span className="text-accent-ink">+{solve!.points ?? 0}</span></span>
      mode = 'play'
    } else if (mine.status !== 'open') {
      chip = <span className="inline-block align-top px-2.5 py-1 rounded-full border-2 border-fg/25 text-xs font-extrabold truncate max-w-full">See {partner}’s go</span>
      mode = 'theirs'
    } else {
      chip = <span className="text-xs font-extrabold text-fg/50">Sent ✓</span>
      mode = null
    }
  } else if (!next) {
    // Nothing set for today yet (day one, or a missed day) → set one for today, so
    // there's something to play right away, instead of only ever setting for tomorrow.
    // "for today" only where there's room for it; a half-width tile just says whose.
    const what = !mine && wide ? `Set ${partner}'s for today` : solved ? `Now set ${partner}'s` : `Set ${partner}'s`
    chip = <span className="inline-block align-top px-2.5 py-1 rounded-full border-2 border-fg/25 text-xs font-extrabold truncate max-w-full">{what}</span>
    // Finished theirs? The tile opens your result — setting theirs is the button there.
    mode = solved ? 'play' : 'set'
  } else {
    chip = (
      <span className="text-xs font-extrabold text-fg/50">
        {solved ? <>Done · <span className="text-accent-ink">+{solve!.points ?? 0}</span></> : 'Sent ✓'}
      </span>
    )
    mode = solved ? 'play' : null
  }

  return (
    <button
      onClick={() => { if (mode) onOpen(mode) }}
      disabled={mode === null}
      className={
        'text-left rounded-[1.25rem] border-2 px-3.5 py-3 active:translate-y-px transition-colors flex ' +
        (wide ? 'col-span-2 items-center gap-3 ' : 'flex-col gap-2.5 ') +
        (complete ? 'border-fg/15 bg-fg/[0.03]' : 'border-fg bg-card shadow-[3px_3px_0_rgba(0,0,0,0.12)]')
      }
    >
      <div className={'flex items-center gap-2 min-w-0 ' + (wide ? 'flex-1' : '')}>
        <span className="shrink-0 w-8 h-8 rounded-[10px] bg-fg/[0.05] inline-flex items-center justify-center"><KindIcon kind={kind} /></span>
        <span className="flex-1 min-w-0 font-display text-base font-bold leading-tight break-words">{NAMES[kind]}</span>
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
    case 'either':
      return (
        <svg viewBox="0 0 24 24" className={box} aria-hidden="true">
          <rect x="1.5" y="5" width="10" height="14" rx="3" fill="rgb(var(--pa))" />
          <rect x="12.5" y="5" width="10" height="14" rx="3" fill="rgb(var(--pb))" />
        </svg>
      )
  }
}

// ---------------------------------------------------------------- screens

// Solve screens show the puzzle as stored; set screens go through SetScreen below.
function PuzzleScreen({
  screen,
  data,
  pools,
  onClose,
  onSwitch,
}: {
  screen: Screen
  data: Extract<BoardData, { state: 'paired' }>
  pools: Pools
  onClose: () => void
  onSwitch: (s: Screen) => void
}) {
  const { partner, me, kinds } = data
  const tomorrow = localDate(1)
  const ourWords = useIdeas().filter((i) => i.kind === 'word').map((i) => i.text)

  // Setting for tomorrow is the normal flow — but if nothing's been set for today at
  // all yet (day one, or a day you both missed), set that one for today instead, so
  // there's something to play right away. `undefined` here means "today" to every Set…
  // component below (see e.g. SetDialClue's `forDate` prop).
  const setDate = (k: Kind): string | undefined => (kinds[k]?.mine ? tomorrow : undefined)

  if (screen.mode === 'theirs') {
    const mine = kinds[screen.kind]?.mine
    // Back to your own result — or, with nothing of theirs to play today, the board.
    const own = !!kinds[screen.kind]?.solve
    if (mine) return <TheirGo puzzle={mine} partner={partner} me={me} onClose={own ? () => onSwitch({ kind: screen.kind, mode: 'play' }) : onClose} back={own ? 'Back to mine' : 'Done'} />
  }

  if (screen.mode === 'play' || screen.mode === 'theirs') {
    // Under your own result: first, the button to set theirs for tomorrow; only once
    // that's done, the way to see how they did on the one you set them today.
    const k = kinds[screen.kind]!
    const doneToday = !!k.next || (!!k.mine && caughtUpOn(localDate(), screen.kind))
    const extra = doneToday
      ? <TheirGoButton puzzle={k.mine} partner={partner} onOpen={() => onSwitch({ kind: screen.kind, mode: 'theirs' })} />
      : (
        <button
          onClick={() => onSwitch({ kind: screen.kind, mode: 'set' })}
          className="w-full max-w-sm min-h-[56px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold active:translate-y-px"
        >
          Set {partner}’s for {k.mine ? 'tomorrow' : 'today'}
        </button>
      )
    switch (screen.kind) {
      case 'word': {
        const p = kinds.word.solve!
        return <WordPlay puzzle={p} partner={partner} question={questionFromThem(p.prompt, partner, me)} mine={kinds.word.mine?.answer ?? null} onClose={onClose} extra={extra} />
      }
      case 'dial': return <PlayDial puzzle={kinds.dial.solve!} partner={partner} spectrum={kinds.dial.solve!.prompt} onClose={onClose} extra={extra} />
      case 'top5': return <PlayTop5 puzzle={kinds.top5.solve!} partner={partner} me={me} theme={say(kinds.top5.solve!.prompt, { self: false, subject: partner, partner: me })} onClose={onClose} extra={extra} />
      case 'sketch': return <PlaySketch puzzle={kinds.sketch.solve!} partner={partner} prompt={kinds.sketch.solve!.prompt} onClose={onClose} extra={extra} />
      case 'numbers': return <PlayNumbers puzzle={kinds.numbers.solve!} partner={partner} me={me} onClose={onClose} extra={extra} />
      case 'either': return <PlayEither puzzle={kinds.either!.solve!} partner={partner} onClose={onClose} extra={extra} />
    }
  }

  return <SetScreen kind={screen.kind} forDate={setDate(screen.kind)} partner={partner} me={me} pools={pools} ourWords={ourWords} onClose={onClose} />
}

// Setting one: the question is settled before the screen opens — your partner's, if they
// already set that day's (the server would file yours under theirs anyway), else the one
// you were shown last time, else the day's own — and then it stays put (see pins.ts).
function SetScreen({ kind, forDate, partner, me, pools, ourWords, onClose }: {
  kind: Kind
  forDate: string | undefined // undefined = today (see setDate)
  partner: string
  me: string
  pools: Pools
  ourWords: string[]
  onClose: () => void
}) {
  const day = forDate ?? localDate()
  const [p, setP] = useState<Pin | null>(null)
  useEffect(() => {
    let live = true
    if (!forDate) markCaughtUp(day, kind)
    const fresh = (): Pin => {
      switch (kind) {
        case 'word': return { prompt: questionOfTheDay(day, pools.words, ourWords) ?? '' }
        case 'dial': {
          const picked = dialOfTheDay(day, pools.content.spectrums)
          return { prompt: picked ? spectrumPrompt(picked) : '', target: Math.floor(Math.random() * 101) }
        }
        case 'top5': {
          const theme = themeOfTheDay(day, pools.content.themes)
          return theme ? { prompt: fiveify(theme.text), items: itemsOfTheDay(day, theme) } : {}
        }
        case 'sketch': return { prompt: sketchOfTheDay(day, pools.content.drawPrompts) ?? '' }
        case 'numbers': return { questions: numbersOfTheDay(day, pools.numbers) ?? [] }
        case 'either': return { questions: eitherOfTheDay(day, pools.either) ?? [] }
      }
    }
    // A server without migration 0018, or no signal: carry on without it after a moment.
    const ask = Promise.race([
      api.dayPrompts(day).catch(() => ({})),
      new Promise<Record<string, never>>((resolve) => setTimeout(() => resolve({}), 4000)),
    ])
    void ask.then((server) => { if (live) setP(settle(day, kind, (server as Record<string, Pin>)[kind], fresh)) })
    return () => { live = false }
    // Settled once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!p) return <div className="h-full grid place-items-center text-fg/30 animate-pulse">…</div>
  switch (kind) {
    case 'word': {
      const template = p.prompt ?? ''
      return <WordAnswer partner={partner} template={template} question={renderQuestion(template, partner)} onClose={onClose} forDate={forDate} />
    }
    case 'dial':
      return <SetDialClue partner={partner} spectrum={p.prompt || 'Cold | Hot'} target={p.target ?? 50} onClose={onClose} forDate={forDate} />
    case 'top5': {
      const template = p.prompt ?? ''
      return <SetTop5 partner={partner} theme={say(template, { self: true, subject: me, partner })} template={template} items={p.items ?? []} onClose={onClose} forDate={forDate} />
    }
    case 'sketch':
      return <SetSketch partner={partner} prompt={p.prompt || 'comfort food'} onClose={onClose} forDate={forDate} />
    case 'numbers':
      return <SetNumbers partner={partner} questions={p.questions ?? []} onClose={onClose} forDate={forDate} />
    case 'either':
      return <SetEither partner={partner} questions={p.questions ?? []} onClose={onClose} forDate={forDate} />
  }
}
