import type { CSSProperties } from 'react'

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
