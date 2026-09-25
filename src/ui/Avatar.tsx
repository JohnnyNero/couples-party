import type { PlayerId } from '../engine/state'
import { usePhoto } from '../profile/store'

// A player's photo if they've added one on their profile, otherwise their initial in
// their own colour: coral for seat A, blue for seat B. A photo still gets a ring in that
// colour, so whose is whose never depends on the picture.
const SIZES = {
  sm: 'w-6 h-6 text-[0.8rem]',
  md: 'w-9 h-9 text-lg',
  lg: 'w-[4.5rem] h-[4.5rem] text-4xl',
  xl: 'w-24 h-24 text-5xl',
} as const

const RINGS = { sm: 'ring-[1.5px]', md: 'ring-2', lg: 'ring-[3px]', xl: 'ring-4' } as const

export function Avatar({ p, name, size = 'md', className = '', photo }: { p: PlayerId; name: string; size?: keyof typeof SIZES; className?: string; photo?: string | null }) {
  const found = usePhoto(name)
  const src = photo === undefined ? found : photo
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={
          'shrink-0 rounded-full object-cover bg-fg/10 ' + RINGS[size] + (p === 'A' ? ' ring-pa ' : ' ring-pb ') + SIZES[size] + ' ' + className
        }
      />
    )
  }
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
