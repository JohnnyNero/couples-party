import { useState, type ReactNode } from 'react'
import type { Game } from './mode'
import { GAME_LABELS, roster } from '../engine/roster'
import { PickButton } from './PickButton'
import { ThemeToggle } from '../views/ThemeToggle'
import { DailyCard, type DailyScreen } from '../daily/DailyCard'
import { WordPlay } from '../daily/WordPlay'
import { WordAnswer } from '../daily/WordAnswer'
import { DialCard, type DialScreen } from '../daily/DialCard'
import { PlayDial } from '../daily/PlayDial'
import { SetDialClue } from '../daily/SetDialClue'
import { useDaily, useDailyDial } from '../daily/useDaily'

// The front door. Two tabs: Today, which is the nightly habit — one short session, the
// same shape every night — and Games, for when you've got longer or want one thing.
// Today is where the daily puzzles will live too once there's a server to pass them
// between your phones.

type Tab = 'today' | 'games'

const TAB_KEY = 'couples-party:tab'

function loadTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'games' ? 'games' : 'today'
  } catch {
    return 'today'
  }
}

export function Home({ onPick }: { onPick: (g: Game) => void }) {
  const [tab, setTab] = useState<Tab>(loadTab)
  const daily = useDaily()
  const dial = useDailyDial()
  const [screen, setScreen] = useState<DailyScreen | null>(null)
  const [dialScreen, setDialScreen] = useState<DialScreen | null>(null)
  const choose = (t: Tab) => {
    setTab(t)
    try { localStorage.setItem(TAB_KEY, t) } catch { /* private mode — just don't remember */ }
  }

  // The puzzle screens take the whole phone; closing one re-reads the day so the card
  // shows what just happened.
  const close = () => { setScreen(null); void daily.refresh() }
  if (screen?.kind === 'play') {
    return <WordPlay puzzle={screen.puzzle} partner={screen.partner} question={screen.question} mine={screen.mine} onClose={close} />
  }
  if (screen?.kind === 'answer') {
    return <WordAnswer partner={screen.partner} template={screen.template} question={screen.question} onClose={close} />
  }
  const closeDial = () => { setDialScreen(null); void dial.refresh() }
  if (dialScreen?.kind === 'play') {
    return <PlayDial puzzle={dialScreen.puzzle} partner={dialScreen.partner} spectrum={dialScreen.spectrum} onClose={closeDial} />
  }
  if (dialScreen?.kind === 'answer') {
    return <SetDialClue partner={dialScreen.partner} spectrum={dialScreen.spectrum} onClose={closeDial} />
  }

  return (
    <div className="h-full w-full flex flex-col select-none">
      <header className="shrink-0 flex items-center justify-between gap-3 px-6 pt-5 pb-3 pr-14">
        <div className="font-display text-2xl font-bold tracking-tight">Couples Party</div>
        <ThemeToggle />
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div key={tab} className="w-full max-w-xl mx-auto animate-fade-up">
          {tab === 'today'
            ? <Today onPick={onPick} daily={daily} open={setScreen} dial={dial} openDial={setDialScreen} />
            : <Games onPick={onPick} />}
        </div>
      </main>
      <nav className="shrink-0 border-t border-fg/15 bg-bg grid grid-cols-2 pb-[env(safe-area-inset-bottom)]">
        <TabButton active={tab === 'today'} onClick={() => choose('today')} label="Today" icon={<MoonIcon />} />
        <TabButton active={tab === 'games'} onClick={() => choose('games')} label="Games" icon={<GridIcon />} />
      </nav>
    </div>
  )
}

function Today({
  onPick,
  daily,
  open,
  dial,
  openDial,
}: {
  onPick: (g: Game) => void
  daily: ReturnType<typeof useDaily>
  open: (s: DailyScreen) => void
  dial: ReturnType<typeof useDailyDial>
  openDial: (s: DialScreen) => void
}) {
  const tonight = roster('tonight').map((e) => GAME_LABELS[e.key])
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">{date}</div>
      <DailyCard daily={daily} open={open} />
      <DialCard daily={dial} open={openDial} />
      <section className="rounded-3xl bg-ink text-paper p-6 shadow-[5px_5px_0_rgba(0,0,0,0.12)]">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-paper/50">About five minutes</div>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Tonight</h1>
        <ol className="mt-4 flex flex-col gap-1.5">
          {tonight.map((label, i) => (
            <li key={label} className="flex items-baseline gap-3 text-base">
              <span className="w-4 text-accent font-bold tabular-nums">{i + 1}</span>
              <span className={i === tonight.length - 1 ? 'text-paper/60' : ''}>{label}</span>
            </li>
          ))}
        </ol>
        <button
          onClick={() => onPick('tonight')}
          className="mt-6 w-full min-h-[56px] rounded-2xl bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        >
          Play tonight
        </button>
      </section>
      <p className="text-sm text-fg/50 leading-relaxed">
        Same shape every night, different questions. A warm-up, something about each
        other, one drawing each — and a question to turn the light off on.
      </p>
    </div>
  )
}

const GAME_BLURBS: Record<Exclude<Game, 'full' | 'tonight'>, string> = {
  list: 'Rank seven things for them · they guess your order',
  likely: 'Tap a name in secret · score when you agree',
  finger: 'Five confessions · keep your hand up',
  mrmrs: 'Your answer, and your guess at theirs',
  wave: 'Name a thing on a scale · they find the spot',
  draw: 'Answer about yourself, then draw it',
}

function Games({ onPick }: { onPick: (g: Game) => void }) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <PickButton
        onClick={() => onPick('full')}
        title="The full session"
        sub="Every game, then lights out · about 25 minutes"
      />
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mt-3 mb-1">Or just one</div>
      {(Object.keys(GAME_BLURBS) as Array<keyof typeof GAME_BLURBS>).map((g) => (
        <PickButton key={g} onClick={() => onPick(g)} title={GAME_LABELS[g]} sub={GAME_BLURBS[g]} />
      ))}
    </div>
  )
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={
        'min-h-[60px] flex flex-col items-center justify-center gap-0.5 text-[0.65rem] uppercase tracking-[0.2em] font-bold ' +
        (active ? 'text-accent' : 'text-fg/40')
      }
    >
      {icon}
      {label}
    </button>
  )
}

const iconProps = {
  viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
}

function MoonIcon() {
  return <svg {...iconProps}><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" /></svg>
}

function GridIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}
