import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Game } from './mode'
import type { GameKey } from '../engine/state'
import { GAME_LABELS, roster } from '../engine/roster'
import { ProfilePage } from '../profile/ProfilePage'
import { refreshProfile, useProfile } from '../profile/store'
import { refreshIdeas } from '../ideas/store'
import { Avatar } from '../ui/Avatar'
import { Wordmark } from '../ui/Logo'
import { Board } from '../daily/Board'
import { useBoard } from '../daily/useDaily'
import { dayIndex, localDate } from '../daily/dates'
import { MemoriesTab } from '../memories/MemoriesTab'
import { GameIcon, GameGlyph } from '../ui/GameIcon'
import { card, eyebrow } from '../ui/styles'

// The front door. Three tabs: Today, the nightly habit — the daily puzzles and one short
// session — Games, for when you've got longer or want one thing, and Memories,
// everything you've played together so far.

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

// Opens the profile page, from the avatar in any tab's header.
const OpenProfile = createContext<() => void>(() => {})

export function Home({ onPick }: { onPick: (g: Game) => void }) {
  const [tab, setTab] = useState<Tab>(loadTab)
  const [profileOpen, setProfileOpen] = useState(false)
  // Bumped after unpairing, so Today fetches its board again from scratch.
  const [epoch, setEpoch] = useState(0)
  useEffect(() => { void refreshProfile(); void refreshIdeas() }, [])
  // A new name redraws Today, so its greeting and board catch up.
  const profile = useProfile()
  const myName = profile && profile.state !== 'single' ? profile.me.name : ''
  const choose = (t: Tab) => {
    setTab(t)
    try { localStorage.setItem(TAB_KEY, t) } catch { /* private mode — just don't remember */ }
  }

  return (
    <div className="h-full w-full flex flex-col select-none">
      <main className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-6">
        <OpenProfile.Provider value={() => setProfileOpen(true)}>
          <div key={`${tab}-${epoch}-${myName}`} className="w-full max-w-xl mx-auto animate-fade-up">
            {tab === 'today' ? <Today onPick={onPick} /> : tab === 'games' ? <Games onPick={onPick} /> : <Memories />}
          </div>
        </OpenProfile.Provider>
      </main>
      <nav className="shrink-0 border-t border-fg/10 bg-bg grid grid-cols-3 pb-[env(safe-area-inset-bottom)]">
        <TabButton active={tab === 'today'} onClick={() => choose('today')} label="Today" icon={<MoonIcon />} />
        <TabButton active={tab === 'games'} onClick={() => choose('games')} label="Games" icon={<GridIcon />} />
        <TabButton active={tab === 'memories'} onClick={() => choose('memories')} label="Memories" icon={<BookIcon />} />
      </nav>
      {profileOpen && (
        <ProfilePage
          onClose={() => setProfileOpen(false)}
          onUnpaired={() => { setProfileOpen(false); setEpoch((n) => n + 1); choose('today') }}
        />
      )}
    </div>
  )
}

// Each tab's own title, with the theme toggle (and anything else) on the right.
function TabHeader({ over, title, sub, right, logo = false }: { over?: string; title: string; sub?: string; right?: ReactNode; logo?: boolean }) {
  const controls = (
    <div className="shrink-0 flex items-center gap-2">
      {right}
      <ProfileButton />
    </div>
  )
  // With a line over the title (Today's date), that line shares the row with the
  // controls and the title gets the full width underneath, on one line — shrinking a
  // little for long names, and trimmed with an ellipsis only past that.
  if (over) {
    return (
      <header className="mb-4">
        <div className="flex items-center justify-between gap-3 min-h-[2.75rem]">
          <div className={eyebrow + ' min-w-0 truncate'}>{over}</div>
          {controls}
        </div>
        <h1 className="mt-1 font-display text-[clamp(1.45rem,7.6vw,1.9rem)] font-extrabold leading-[1.1] tracking-tight whitespace-nowrap truncate">
          {logo ? <Wordmark /> : title}
        </h1>
        {sub && <div className="mt-0.5 text-sm text-fg/60">{sub}</div>}
      </header>
    )
  }
  return (
    <header className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="font-display text-[1.9rem] font-extrabold leading-[1.05] tracking-tight">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-fg/60">{sub}</div>}
      </div>
      {controls}
    </header>
  )
}

// You, top right of every tab: your photo or initial, or a plain figure before you've
// paired. Tapping it opens the profile page.
function ProfileButton() {
  const open = useContext(OpenProfile)
  const profile = useProfile()
  const me = profile && profile.state !== 'single' ? profile.me : null
  return (
    <button onClick={open} aria-label="Profile" className="shrink-0 rounded-full active:translate-y-px">
      {me ? (
        <Avatar p="A" name={me.name} size="md" className="!w-10 !h-10" />
      ) : (
        <span className="w-10 h-10 rounded-full border-2 border-fg/15 text-fg/60 inline-flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" />
          </svg>
        </span>
      )}
    </button>
  )
}

function Today({ onPick }: { onPick: (g: Game) => void }) {
  const board = useBoard()
  const paired = board.status.kind === 'ready' && board.status.data.state === 'paired' ? board.status.data : null
  // Short weekday, so it fits beside the streak on a phone.
  const date = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <div className="flex flex-col gap-4">
      <TabHeader
        over={date}
        title={paired ? `Hey ${paired.me} & ${paired.partner}` : 'Coupled'}
        logo={!paired}
        right={paired && (paired.streak > 0 || (paired.stats?.daysLast7 ?? 0) > 0) ? <Streak n={paired.streak} last7={paired.stats?.daysLast7 ?? null} /> : null}
      />
      <Board board={board} />
      <TonightCard onPlay={() => onPick('tonight')} />
    </div>
  )
}

// The streak, never with blame: it's the two of you, and it never says who missed. Beside
// the count, how many of the last seven days you both played — so one missed day (which
// the streak forgives anyway) doesn't read as failing. When it does lapse: life happens.
function Streak({ n, last7 }: { n: number; last7: number | null }) {
  const flame = (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c1 3 4.5 4.5 4.5 9a4.5 4.5 0 0 1-9 0c0-2 1-3.5 2-4.5.2 1.6 1 2.6 2 2.6 0-3.2-.8-4.6.5-7.1z" />
    </svg>
  )
  if (n === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/[0.06] text-fg/70 px-3 py-1 text-xs font-extrabold leading-tight whitespace-nowrap">
        {flame}
        <span className="flex flex-col">
          <span>Life happens</span>
          <span className="font-bold text-fg/50">Play today to start again</span>
        </span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-pa-soft text-pa-ink px-3 py-1 text-xs font-extrabold leading-tight whitespace-nowrap">
      {flame}
      <span className="flex flex-col">
        <span>{n}-day streak</span>
        {last7 !== null && <span className="font-bold opacity-70">{last7} of the last 7 days</span>}
      </span>
    </span>
  )
}

// Tonight's line-up as icons, fillers marked out, and one big button.
function TonightCard({ onPlay }: { onPlay: () => void }) {
  const lineup = roster('tonight', dayIndex(localDate())).filter((e) => e.key !== 'lights')
  const games = lineup.filter((e) => e.key !== 'circle' && e.key !== 'clock').length
  return (
    <section className="rounded-[1.75rem] bg-ink text-paper p-5 flex flex-col gap-3.5 shadow-[4px_4px_0_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-[1.75rem] font-extrabold leading-none">Tonight</div>
          <div className="mt-1 text-sm text-paper/65">About 10 minutes · {games} games and a filler</div>
        </div>
        <GameGlyph game="lights" className="w-7 h-7 text-accent" />
      </div>
      <div className="flex gap-2">
        {lineup.map((e) => {
          const filler = e.key === 'circle' || e.key === 'clock'
          return (
            <div
              key={e.key}
              className={
                'flex-1 min-w-0 flex flex-col items-center gap-1 rounded-2xl py-2 ' +
                (filler ? 'bg-accent/20 text-accent' : 'bg-paper/[0.08] text-paper')
              }
            >
              <GameGlyph game={e.key} className="w-[22px] h-[22px]" />
              <span className={'text-[0.62rem] font-bold truncate max-w-full px-1 ' + (filler ? '' : 'text-paper/75')}>
                {SHORT[e.key]}
              </span>
            </div>
          )
        })}
      </div>
      <button
        onClick={onPlay}
        className="w-full min-h-[52px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold tracking-wide active:translate-y-px"
      >
        Play tonight
      </button>
    </section>
  )
}

const SHORT: Record<GameKey, string> = {
  list: 'Shortlist', likely: 'Likely', finger: 'Finger', mrmrs: 'Mr & Mrs', wave: 'Wavelength',
  draw: 'Draw', clash: 'Clash', chain: 'Chain', bluff: '2 Lies', circle: 'Circle', clock: 'Clock', lights: 'Lights out',
}

type Pick = { key: Exclude<Game, 'full' | 'tonight'>; blurb: string; meta: string }

const HEAD_TO_HEAD: Pick[] = [
  { key: 'list', blurb: 'Rank seven things for them. They guess your order.', meta: '2 acts · 6 min' },
  { key: 'finger', blurb: 'Five confessions. Keep your hand up.', meta: '5 rounds · 3 min' },
  { key: 'wave', blurb: 'Name a thing on a scale. They find the spot.', meta: '3 rounds · 5 min' },
  { key: 'mrmrs', blurb: 'Your answer, and your guess at theirs.', meta: '5 rounds · 5 min' },
  { key: 'draw', blurb: 'Answer about yourself, then draw it.', meta: '3 rounds · 6 min' },
  { key: 'clash', blurb: 'One letter, six categories. Unique answers score.', meta: '3 rounds · 5 min' },
  { key: 'chain', blurb: 'Name things in turn. The last letter starts the next.', meta: '4 rounds · 4 min' },
  { key: 'bluff', blurb: 'Two lies and a truth about you. Can they spot it?', meta: '3 rounds · 8 min' },
]
const FILLERS: Pick[] = [
  { key: 'circle', blurb: 'The rounder one wins', meta: 'Best of 5' },
  { key: 'clock', blurb: 'Closest tap wins', meta: 'Best of 5' },
]

function Games({ onPick }: { onPick: (g: Game) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <TabHeader title="Games" sub="Every one of them is you against each other." />
      <section className="rounded-[1.75rem] bg-ink text-paper p-5 flex items-center gap-4 shadow-[4px_4px_0_rgba(0,0,0,0.18)]">
        <div className="flex-1 min-w-0">
          <div className="font-display text-2xl font-extrabold leading-tight">The full session</div>
          <div className="mt-1 text-sm text-paper/65">Every game and both fillers · about 40 min</div>
        </div>
        <button
          onClick={() => onPick('full')}
          className="shrink-0 min-h-[48px] px-5 rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px"
        >
          Play
        </button>
      </section>

      <div className={eyebrow + ' mt-1'}>Head to head</div>
      <div className="grid grid-cols-2 gap-3">
        {HEAD_TO_HEAD.map((g, i) => {
          const wide = i === HEAD_TO_HEAD.length - 1 && HEAD_TO_HEAD.length % 2 === 1
          return (
            <button
              key={g.key}
              onClick={() => onPick(g.key)}
              className={
                card + ' text-left p-4 flex active:translate-y-px ' +
                (wide ? 'col-span-2 items-center gap-3' : 'flex-col gap-2')
              }
            >
              <GameIcon game={g.key} />
              <div className={wide ? 'flex-1 min-w-0' : 'contents'}>
                <div className="font-display text-[1.05rem] font-bold leading-tight">{GAME_LABELS[g.key]}</div>
                <div className="text-xs text-fg/60 leading-snug">{g.blurb}</div>
              </div>
              <div className={'text-[0.7rem] font-extrabold text-fg/45 ' + (wide ? 'text-right shrink-0' : '')}>{g.meta}</div>
            </button>
          )
        })}
      </div>

      <div className={eyebrow + ' mt-1'}>Quick fillers · 30 seconds</div>
      <div className="grid grid-cols-2 gap-3">
        {FILLERS.map((g) => (
          <button
            key={g.key}
            onClick={() => onPick(g.key)}
            className="text-left rounded-3xl border-2 border-dashed border-fg/30 px-4 py-3 flex items-center gap-3 active:translate-y-px"
          >
            <GameGlyph game={g.key} className="w-7 h-7 shrink-0 text-accent-ink" />
            <div className="min-w-0">
              <div className="font-display text-base font-bold leading-tight">{GAME_LABELS[g.key]}</div>
              <div className="text-[0.7rem] text-fg/55">{g.blurb}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Memories() {
  return (
    <div className="flex flex-col">
      <TabHeader title="Memories" sub="Every night you've played together." />
      <MemoriesTab />
    </div>
  )
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={
        'min-h-[60px] flex flex-col items-center justify-center gap-0.5 text-[0.68rem] uppercase tracking-[0.14em] font-extrabold ' +
        (active ? 'text-accent-ink' : 'text-fg/40')
      }
    >
      {icon}
      {label}
    </button>
  )
}

const iconProps = {
  viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
}

function MoonIcon() {
  return <svg {...iconProps}><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" /></svg>
}

function BookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
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
