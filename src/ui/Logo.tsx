import { useId } from 'react'

// Coupled's mark: two links of a chain, one each in your colours, looped through each
// other so together they read as an infinity sign. The coral link passes over the blue
// one at the top crossing and under it at the bottom — a real interlock, not an overlap.
// `on` is the colour it sits on, so the little gaps at the crossings match it.

const CX = [35, 65] as const
const RX = 19
const RY = 15
const SW = 9.5

function Link({ cx, colour, width = SW }: { cx: number; colour: string; width?: number }) {
  return <ellipse cx={cx} cy={50} rx={RX} ry={RY} fill="none" style={{ stroke: colour }} strokeWidth={width} />
}

export function Logo({ className = 'w-12', on = 'bg' }: { className?: string; on?: 'bg' | 'card' }) {
  const clip = useId()
  const gap = `rgb(var(--${on}))`
  return (
    <svg viewBox="6 30 88 40" className={className} role="img" aria-label="Coupled">
      <defs>
        <clipPath id={clip}><rect x="0" y="50" width="100" height="50" /></clipPath>
      </defs>
      <Link cx={CX[1]} colour="rgb(var(--pb))" />
      <Link cx={CX[0]} colour={gap} width={SW + 5} />
      <Link cx={CX[0]} colour="rgb(var(--pa))" />
      <g clipPath={`url(#${clip})`}>
        <Link cx={CX[1]} colour={gap} width={SW + 5} />
        <Link cx={CX[1]} colour="rgb(var(--pb))" />
      </g>
    </svg>
  )
}

// The name, set beside the mark.
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={'inline-flex items-center gap-2 ' + className}>
      <Logo className="w-[1.6em]" />
      <span>Coupled</span>
    </span>
  )
}
