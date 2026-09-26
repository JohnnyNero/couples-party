import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { buzzAt } from './haptics'

// The reveal kit: the little bits of theatre every game's reveal is built from. The
// keyframes themselves live in tailwind.config.js (flip-in, slam, wiggle, float-up…)
// and index.css (burst, needle-swing, strike, light-*); this is what uses them.
//
// Everything is timed from the moment a phase's screen mounts, which is the moment the
// state arrives — so on both phones the same card flips at the same beat.

// A delay for an animation, as a style: `style={at(900)}`.
export const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` })

// A verdict: a hit slams in, a miss lands with a wobble.
export const verdictFx = (hit: boolean) => (hit ? 'animate-slam' : 'animate-wiggle')

const CONFETTI = ['--pa', '--pb', '--accent', '--tan-ink', '--sage-ink']

// A pop of confetti (or hearts) out of the middle of whatever it's placed in — give the
// parent `relative`. For a match, a bullseye, a win: rare enough to stay a treat.
// Positions are fixed per piece rather than random, so a re-render mid-flight (a
// partner's tap, a live preview) never sends a piece somewhere else.
export function Burst({ delay = 0, hearts = false, count = 18, spread = 1 }: { delay?: number; hearts?: boolean; count?: number; spread?: number }) {
  // Felt as well as seen, on a phone that can buzz.
  useEffect(() => buzzAt('hit', delay), [delay])
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 w-0 h-0 z-10" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i * 137.508 + (i % 3) * 11) * (Math.PI / 180)
        const dist = (70 + ((i * 53) % 60)) * spread
        const dx = Math.cos(angle) * dist
        const dy = Math.sin(angle) * dist * 0.8 - 26
        const rot = ((i * 97) % 360) - 180
        const colour = CONFETTI[i % CONFETTI.length]
        const style = {
          '--dx': `${dx.toFixed(0)}px`,
          '--dy': `${dy.toFixed(0)}px`,
          '--rot': `${rot}deg`,
          animation: `burst 1100ms cubic-bezier(0.15,0.7,0.3,1) ${delay + (i % 4) * 25}ms both`,
          color: `rgb(var(${colour}))`,
          backgroundColor: hearts ? undefined : `rgb(var(${colour}))`,
        } as CSSProperties
        return hearts ? (
          <span key={i} style={style} className="absolute left-0 top-0 text-xl leading-none">♥</span>
        ) : (
          <span key={i} style={style} className={'absolute left-0 top-0 rounded-[2px] ' + (i % 2 ? 'w-2 h-3.5' : 'w-2.5 h-2.5')} />
        )
      })}
    </span>
  )
}

// "+12", rising off whatever earned it. Give the parent `relative`.
export function FloatPoints({ points, delay = 0, className = '' }: { points: number; delay?: number; className?: string }) {
  if (!points) return null
  return (
    <span className="pointer-events-none absolute left-1/2 -top-3 -translate-x-1/2 z-10" aria-hidden="true">
      <span style={at(delay)} className={'block whitespace-nowrap font-display text-xl font-extrabold animate-float-up ' + className}>
        +{points}
      </span>
    </span>
  )
}

// The leader's crown.
export function Crown({ className = 'w-7 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" className={className} fill="#F2B544" stroke="rgb(var(--fg))" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
      <path d="M3 16L2 5l5 4 5-7 5 7 5-4-1 11z" />
    </svg>
  )
}

// PERFECT, FIRST TRY: a rubber stamp brought down on whatever earned it. Give the parent
// `relative`; it sits over the top-right corner.
export function Stamp({ children, delay = 0, tone = 'sage' }: { children: string; delay?: number; tone?: 'sage' | 'accent' | 'tan' }) {
  const colour = { sage: 'text-sage-ink border-sage-ink', accent: 'text-accent-ink border-accent-ink', tan: 'text-tan-ink border-tan-ink' }[tone]
  useEffect(() => buzzAt('stamp', delay + 300), [delay])
  return (
    <span className="pointer-events-none absolute -right-1 -top-4 z-20" aria-hidden="true">
      <span
        style={at(delay)}
        className={'block rounded-lg border-[3px] bg-bg/85 px-2.5 py-0.5 font-display text-lg sm:text-2xl font-extrabold uppercase tracking-[0.12em] animate-stamp ' + colour}
      >
        {children}
      </span>
    </span>
  )
}

const FALL = ['--pa', '--pb', '--accent', '--tan-ink', '--sage-ink', '--pa', '--pb']

// The big occasions — a new best night, a streak milestone, everything done for the
// day: confetti falling over the whole screen. Onto <body>, so nothing it sits inside
// can clip it; it clears itself away when it's fallen.
export function Shower({ delay = 0, hearts = false, count = 44 }: { delay?: number; hearts?: boolean; count?: number }) {
  const [on, setOn] = useState(true)
  useEffect(() => buzzAt('win', delay), [delay])
  useEffect(() => {
    const id = setTimeout(() => setOn(false), delay + 4200)
    return () => clearTimeout(id)
  }, [delay])
  if (!on || typeof document === 'undefined') return null
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const colour = FALL[i % FALL.length]
        const style = {
          left: `${((i * 61) % 100) + ((i % 3) - 1) * 1.5}%`,
          '--sway': `${12 + ((i * 29) % 26)}px`,
          '--spin': `${((i * 137) % 540) + 180}deg`,
          animation: `fall ${2300 + ((i * 97) % 1300)}ms linear ${delay + ((i * 83) % 1400)}ms both`,
          color: `rgb(var(${colour}))`,
          backgroundColor: hearts && i % 2 ? undefined : `rgb(var(${colour}))`,
        } as CSSProperties
        return hearts && i % 2 ? (
          <span key={i} style={style} className="absolute top-0 text-2xl leading-none">♥</span>
        ) : (
          <span key={i} style={style} className={'absolute top-0 rounded-[2px] ' + (i % 3 === 0 ? 'w-2.5 h-4' : 'w-3 h-3')} />
        )
      })}
    </div>,
    document.body,
  )
}

// Whether this is the first time this phone has seen `key` — so a celebration plays
// once (the first time you open Today after finishing the lot), not every visit. It's
// noted as seen once shown; a phone that won't store things just celebrates each time.
export function useFirstTime(key: string | null): boolean {
  // Decided once per key, the first time this screen sees it — a key can turn up while
  // the screen is already open (the last puzzle finished, the board refreshed).
  const decided = useRef(new Map<string, boolean>())
  if (key && !decided.current.has(key)) {
    let first = true
    try { first = localStorage.getItem(`coupled:seen:${key}`) === null } catch { /* celebrate */ }
    decided.current.set(key, first)
  }
  const first = !!key && decided.current.get(key) === true
  useEffect(() => {
    if (!key || !first) return
    try { localStorage.setItem(`coupled:seen:${key}`, '1') } catch { /* nowhere to keep it */ }
  }, [key, first])
  return first
}
