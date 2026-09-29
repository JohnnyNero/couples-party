import { useRef, useState, type ReactNode } from 'react'
import { KindIcon, NAMES } from '../daily/Board'
import { roster, isFiller } from '../engine/roster'
import { dayIndex, localDate } from '../daily/dates'
import { GameIcon } from '../ui/GameIcon'
import { Logo } from '../ui/Logo'
import { btnAccent } from '../ui/styles'
import { at } from '../ui/fx'

// How Coupled works, in four cards you swipe through: what it is, the daily puzzles, the
// game night, and what builds up over time. Shown on a new phone before setting up, to
// someone who's just accepted an invite, and again from the profile page.

type Slide = { key: string; title: string; body: string; picture: ReactNode }

export const SLIDES: Slide[] = [
  {
    key: 'what',
    title: 'Little games for the two of you',
    body: 'A few minutes of play every day, on your own two phones — side by side on the sofa, or miles apart.',
    picture: <TwoOfYou />,
  },
  {
    key: 'daily',
    title: 'Every day, puzzles you set each other',
    body: 'Six little puzzles, each one made by your partner — guess their word, find their spot on the dial, rank their top five. Solve yours, then set theirs for tomorrow.',
    picture: <DailyTiles />,
  },
  {
    key: 'night',
    title: 'Game night, whenever you fancy',
    body: 'Today’s games take about ten minutes on both phones at once: quizzes, quick-fire rounds and ones about how well you know each other. There are points for you, and points for the team.',
    picture: <TonightLineup />,
  },
  {
    key: 'keep',
    title: 'It all adds up',
    body: 'Keep a streak going together, fill in a crossword each week, and look back on everything you’ve played in Memories.',
    picture: <KeepGoing />,
  },
]

export function Tour({ onDone, onSkip, last = 'Next' }: { onDone: () => void; onSkip?: () => void; last?: string }) {
  const [i, setI] = useState(0)
  const startX = useRef<number | null>(null)
  const go = (n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)))
  const next = () => (i === SLIDES.length - 1 ? onDone() : go(i + 1))
  const slide = SLIDES[i]
  return (
    <div
      className="flex-1 min-h-0 flex flex-col select-none touch-pan-y"
      onPointerDown={(e) => { startX.current = e.clientX }}
      onPointerUp={(e) => {
        if (startX.current === null) return
        const dx = e.clientX - startX.current
        startX.current = null
        if (dx < -50) next()
        else if (dx > 50) go(i - 1)
      }}
    >
      <div className="flex items-center justify-between min-h-[44px]">
        <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, n) => (
            <button
              key={s.key}
              onClick={() => go(n)}
              aria-label={`Go to step ${n + 1}`}
              className={'h-2 rounded-full transition-all duration-300 ' + (n === i ? 'w-6 bg-pa' : 'w-2 bg-fg/20')}
            />
          ))}
        </div>
        {onSkip && (
          <button onClick={onSkip} className="min-h-[44px] px-2 text-sm font-bold text-fg/50">Skip</button>
        )}
      </div>
      <div key={slide.key} className="flex-1 min-h-0 flex flex-col justify-center gap-7 animate-fade-up">
        <div className="flex justify-center min-h-[12rem] items-center">{slide.picture}</div>
        <div className="text-center">
          <h1 className="font-display text-[2rem] font-extrabold leading-[1.1] tracking-tight">{slide.title}</h1>
          <p className="mt-3 text-[1.05rem] text-fg/65 leading-snug">{slide.body}</p>
        </div>
      </div>
      <div className="pt-4 flex gap-2">
        {i > 0 && (
          <button onClick={() => go(i - 1)} className="press min-h-[56px] px-5 rounded-2xl border-2 border-fg/15 font-display text-lg font-extrabold text-fg/60">
            Back
          </button>
        )}
        <button onClick={next} className={btnAccent}>
          {i === SLIDES.length - 1 ? last : 'Next'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- pictures

function TwoOfYou() {
  return (
    <div className="flex flex-col items-center gap-5">
      <Logo className="w-40" link="once" />
      <div className="flex items-center gap-3">
        <span className="flex flex-col items-center gap-1 animate-pop" style={at(500)}>
          <Person className="bg-pa" />
          <span className="text-xs font-extrabold text-pa-ink">You</span>
        </span>
        <span className="font-display text-2xl font-extrabold text-fg/25">+</span>
        <span className="flex flex-col items-center gap-1 animate-pop" style={at(700)}>
          <Person className="bg-pb" />
          <span className="text-xs font-extrabold text-pb-ink">Your partner</span>
        </span>
      </div>
    </div>
  )
}

export function Person({ className, size = 'w-[4.5rem] h-[4.5rem]', glyph = 'w-10 h-10' }: { className: string; size?: string; glyph?: string }) {
  return (
    <span className={size + ' rounded-full text-white inline-flex items-center justify-center ' + className}>
      <svg viewBox="0 0 24 24" className={glyph} fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="8.5" r="4" />
        <path d="M4.5 20.5c.9-4 3.9-6.3 7.5-6.3s6.6 2.3 7.5 6.3z" />
      </svg>
    </span>
  )
}

// A corner of a crossword, part filled in: HUGS across, SOFA down, LOAF across.
const GRID = ['HU S', '###O', 'L AF', '### ']

function DailyTiles() {
  const kinds = Object.keys(NAMES) as (keyof typeof NAMES)[]
  return (
    <div className="grid grid-cols-3 gap-2.5 w-full max-w-[20rem]">
      {kinds.map((k, n) => (
        <div
          key={k}
          style={at(n * 80)}
          className="rounded-2xl border-2 border-fg bg-card px-2 py-3 flex flex-col items-center gap-1.5 shadow-[3px_3px_0_rgba(0,0,0,0.12)] animate-pop"
        >
          <KindIcon kind={k} />
          <span className="text-[0.7rem] font-extrabold leading-tight text-center">{NAMES[k]}</span>
        </div>
      ))}
    </div>
  )
}

function TonightLineup() {
  const lineup = roster('tonight', dayIndex(localDate())).filter((e) => e.key !== 'lights')
  return (
    <div className="w-full max-w-[20rem] rounded-[1.75rem] bg-ink text-paper p-4 flex flex-col gap-3 shadow-[4px_4px_0_rgba(0,0,0,0.18)]">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-2xl font-extrabold">Today</span>
        <span className="text-xs font-bold text-paper/60">about 10 min</span>
      </div>
      <div className="flex gap-2">
        {lineup.map((e, n) => (
          <span key={e.key} style={at(n * 90)} className={'flex-1 flex justify-center rounded-xl py-2 animate-pop ' + (isFiller(e.key) ? 'bg-accent/20' : 'bg-paper/10')}>
            <GameIcon game={e.key} size="sm" />
          </span>
        ))}
      </div>
      <div className="flex gap-2 text-[0.7rem] font-extrabold">
        <span className="flex-1 rounded-full bg-pa px-2 py-1 text-center text-white">Your points</span>
        <span className="flex-1 rounded-full bg-tan-soft px-2 py-1 text-center text-tan-ink">🤝 Team points</span>
      </div>
    </div>
  )
}

function KeepGoing() {
  return (
    <div className="w-full max-w-[20rem] flex flex-col gap-2.5">
      <div className="self-start rounded-full bg-accent/15 text-accent-ink px-3.5 py-1.5 text-sm font-extrabold animate-pop inline-flex items-center gap-1.5">
        <span aria-hidden="true">🔥</span> 12-day streak
      </div>
      <div style={at(150)} className="self-end rounded-2xl border-2 border-fg bg-card p-2.5 shadow-[3px_3px_0_rgba(0,0,0,0.12)] animate-pop">
        <div className="grid grid-cols-4 gap-0.5">
          {GRID.join('').split('').map((c, n) => (
            <span key={n} className={'w-7 h-7 text-sm font-extrabold grid place-items-center rounded-[4px] ' + (c === '#' ? 'bg-fg' : 'border-2 border-fg/25 text-pa-ink')}>
              {c === '#' || c === ' ' ? '' : c}
            </span>
          ))}
        </div>
      </div>
      <div style={at(300)} className="rounded-2xl border-2 border-fg/15 bg-card px-3.5 py-2.5 flex items-center gap-3 animate-pop">
        <span className="text-xl" aria-hidden="true">📖</span>
        <div className="min-w-0">
          <div className="text-sm font-extrabold">Memories</div>
          <div className="text-xs text-fg/55 truncate">Every night you’ve played, with your answers</div>
        </div>
      </div>
    </div>
  )
}
