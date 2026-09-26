import type { ReactElement } from 'react'
import type { GameKey } from '../engine/state'

// One line icon per game, drawn here like the theme icons so nothing depends on an
// asset. Used on the Games tab, Tonight's line-up, the in-game header, title cards and
// the scoreboard. `tone` sets the tinted tile behind it; `bare` draws the glyph alone.

const P = (d: string) => <path d={d} />

const GLYPHS: Record<GameKey, ReactElement> = {
  list: (
    <>
      {P('M9 6h11M9 12h11M9 18h11')}
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>
  ),
  likely: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      {P('M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5')}
    </>
  ),
  finger: P('M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7M17 12a1.5 1.5 0 0 1 3 0v3a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5-2.6L4.6 15a1.5 1.5 0 0 1 2.5-1.7L8 14.5'),
  wave: (
    <>
      {P('M3 17a9 9 0 0 1 18 0')}
      {P('M12 17l4.5-6')}
    </>
  ),
  mrmrs: (
    <>
      {P('M4 5h10v7H8l-4 3z')}
      {P('M10 12v3h6l4 3v-8h-4')}
    </>
  ),
  draw: (
    <>
      {P('m15 4 5 5L9 20H4v-5z')}
      {P('m13 6 5 5')}
    </>
  ),
  clash: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      {P('M9 16.5l3-9 3 9M10.2 13.5h3.6')}
    </>
  ),
  chain: (
    <>
      {P('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1')}
      {P('M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1')}
    </>
  ),
  bluff: (
    <>
      {P('M4 6h8M4 12h8M4 18h8')}
      {P('m15 12 2.2 2.2L21 10')}
    </>
  ),
  circle: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="20" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      {P('M12 13.5V9.5M10 2.5h4M12 2.5v3.5')}
    </>
  ),
  lights: P('M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z'),
}

// Each game's tile tint, so the same game always sits on the same colour.
const TONES: Record<GameKey, string> = {
  list: 'bg-tan-soft text-tan-ink',
  likely: 'bg-pb-soft text-pb-ink',
  finger: 'bg-pa-soft text-pa-ink',
  wave: 'bg-pa-soft text-pa-ink',
  mrmrs: 'bg-pb-soft text-pb-ink',
  draw: 'bg-pb-soft text-pb-ink',
  clash: 'bg-sage-soft text-sage-ink',
  chain: 'bg-tan-soft text-tan-ink',
  bluff: 'bg-sage-soft text-sage-ink',
  circle: 'bg-pa-soft text-pa-ink',
  clock: 'bg-pa-soft text-pa-ink',
  lights: 'bg-fg text-bg',
}

export function GameGlyph({ game, className = 'w-6 h-6' }: { game: GameKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {GLYPHS[game]}
    </svg>
  )
}

const TILE = {
  sm: 'w-8 h-8 rounded-[10px]',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-12 h-12 rounded-2xl',
} as const
const GLYPH = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7' } as const

export function GameIcon({ game, size = 'md', className = '' }: { game: GameKey; size?: keyof typeof TILE; className?: string }) {
  return (
    <span className={`shrink-0 inline-flex items-center justify-center ${TILE[size]} ${TONES[game]} ${className}`}>
      <GameGlyph game={game} className={GLYPH[size]} />
    </span>
  )
}
