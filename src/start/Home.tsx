import { useState, type ReactNode } from 'react'
import type { Game } from './mode'
import { GAME_LABELS, roster } from '../engine/roster'
import { PickButton } from './PickButton'
import { ThemeToggle } from '../views/ThemeToggle'
import { Board } from '../daily/Board'
import { dayIndex, localDate } from '../daily/dates'
import { MemoriesTab } from '../memories/MemoriesTab'

// The front door. Three tabs: Today, which is the nightly habit — one short session —
// Games, for when you've got longer or want one thing, and Memories, everything you've
// played together so far.
// Today also carries the daily puzzles — five a day, each set by your partner the day
// before — with the scoreboard between you.

type Tab = 'today' | 'games' | 'memories'

const TAB_KEY = 'couples-party:tab'

function loadTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY)
    return t === 'games' || t === 'memories' ? t : 'today'
  } catch {
    return 'today'
  }
}

export function Home({ onPick }: { onPick: (g: Game) => void }) {
  const [tab, setTab] = useState<Tab>(loadTab)
  const choose = (t: Tab) => {
    setTab(t)
    try { localStorage.setItem(TAB_KEY, t) } catch { /* private mode — just don't remember */ }
  }

  return (
    <div className="h-full w-full flex flex-col select-none">
      <header className="shrink-0 flex items-center justify-between gap-3 px-6 pt-5 pb-3 pr-14">
        <div className="font-display text-2xl font-bold tracking-tight">Couples Party</div>
        <ThemeToggle />
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div key={tab} className="w-full max-w-xl mx-auto animate-fade-up">
          {tab === 'today' ? <Today onPick={onPick} /> : tab === 'games' ? <Games onPick={onPick} /> : <MemoriesTab />}
        </div>
      </main>
      <nav className="shrink-0 border-t border-fg/15 bg-bg grid grid-cols-3 pb-[env(safe-area-inset-bottom)]">
        <TabButton active={tab === 'today'} onClick={() => choose('today')} label="Today" icon={<MoonIcon />} />
        <TabButton active={tab === 'games'} onClick={() => choose('games')} label="Games" icon={<GridIcon />} />
        <TabButton active={tab === 'memories'} onClick={() => choose('memories')} label="Memories" icon={<BookIcon />} />
      </nav>
    </div>
  )
}

function Today({ onPick }: { onPick: (g: Game) => void }) {
  const tonight = roster('tonight', dayIndex(localDate())).map((e) => GAME_LABELS[e.key])
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">{date}</div>
      <Board />
      <section className="rounded-3xl bg-ink text-paper px-5 py-4 shadow-[4px_4px_0_rgba(0,0,0,0.12)] flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-display text-2xl font-bold tracking-tight leading-none">Tonight</div>
          <div className="mt-1.5 text-xs text-paper/60 leading-snug">
            About ten minutes · {tonight.join(' · ')}
          </div>
        </div>
        <button
          onClick={() => onPick('tonight')}
          className="shrink-0 min-h-[48px] px-5 rounded-2xl bg-accent text-bg text-base font-bold uppercase tracking-widest active:translate-y-px"
        >
          Play
        </button>
      </section>
    </div>
  )
}

const GAME_BLURBS: Partial<Record<Exclude<Game, 'full' | 'tonight'>, string>> = {
  list: 'Rank seven things for them · they guess your order',
  finger: 'Five confessions · keep your hand up',
  mrmrs: 'Your answer, and your guess at theirs',
  wave: 'Name a thing on a scale · they find the spot',
  draw: 'Answer about yourself, then draw it',
  clash: 'One letter, six categories · unique answers score',
  chain: 'Name things in turn · the last letter starts the next',
  circle: 'One circle each · the rounder one wins',
  clock: 'Stop a hidden clock on the second',
}

function Games({ onPick }: { onPick: (g: Game) => void }) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <PickButton
        onClick={() => onPick('full')}
        title="The full session"
        sub="Every game, then lights out · about 40 minutes"
      />
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mt-3 mb-1">Or just one</div>
      {(Object.entries(GAME_BLURBS) as Array<[keyof typeof GAME_BLURBS, string]>).map(([g, blurb]) => (
        <PickButton key={g} onClick={() => onPick(g)} title={GAME_LABELS[g]} sub={blurb} />
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

function BookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
      <path d="M12 7.2c-.9-1-2.6-.6-2.6.8 0 1.3 2.6 2.8 2.6 2.8s2.6-1.5 2.6-2.8c0-1.4-1.7-1.8-2.6-.8z" />
    </svg>
  )
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
