import type { PlayerId } from '../engine/state'

// A player's initial in their own colour: coral for seat A, blue for seat B.
const SIZES = {
  sm: 'w-6 h-6 text-[0.8rem]',
  md: 'w-9 h-9 text-lg',
  lg: 'w-[4.5rem] h-[4.5rem] text-4xl',
  xl: 'w-24 h-24 text-5xl',
} as const

export function Avatar({ p, name, size = 'md', className = '' }: { p: PlayerId; name: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={
        'shrink-0 inline-flex items-center justify-center rounded-full font-display font-extrabold leading-none text-white ' +
        (p === 'A' ? 'bg-pa ' : 'bg-pb ') + SIZES[size] + ' ' + className
      }
    >
      <span className="translate-y-[0.06em]">{(name.trim()[0] ?? p).toUpperCase()}</span>
    </span>
  )
}

// Text in a player's colour — for their score, their answer, their name on a reveal.
export const inkOf = (p: PlayerId) => (p === 'A' ? 'text-pa-ink' : 'text-pb-ink')
export const softOf = (p: PlayerId) => (p === 'A' ? 'bg-pa-soft' : 'bg-pb-soft')
export const fillOf = (p: PlayerId) => (p === 'A' ? 'bg-pa' : 'bg-pb')
