import { useId } from 'react'

// Coupled's mark: two links of a chain, one each in your colours, looped through each
// other so together they read as an infinity sign. The coral link passes over the blue
// one at the top crossing and under it at the bottom — a real interlock, not an overlap.
// `on` is the colour it sits on, so the little gaps at the crossings match it.

const CX = [37, 63] as const
const RX = 20
const RY = 14
const SW = 8

function Link({ cx, colour, width = SW }: { cx: number; colour: string; width?: number }) {
  return <ellipse cx={cx} cy={50} rx={RX} ry={RY} fill="none" style={{ stroke: colour }} strokeWidth={width} />
}

// `link`: the two links slide in from either side and hook together — once, as a screen
// opens ('once'), or over and over while one waits ('loop').
export function Logo({ className = 'w-12', on = 'bg', link }: { className?: string; on?: 'bg' | 'card'; link?: 'once' | 'loop' }) {
  const clip = useId()
  const gap = `rgb(var(--${on}))`
  const motion = link === 'once' ? ' logo-link' : link === 'loop' ? ' logo-link-loop' : ''
  return (
    <svg viewBox="8 31 84 38" className={className + motion} role="img" aria-label="Coupled" overflow="visible">
      <defs>
        <clipPath id={clip}><rect x="-30" y="50" width="160" height="50" /></clipPath>
      </defs>
      <g className="logo-right"><Link cx={CX[1]} colour="rgb(var(--pb))" /></g>
      <g className="logo-left">
        <Link cx={CX[0]} colour={gap} width={SW + 5} />
        <Link cx={CX[0]} colour="rgb(var(--pa))" />
      </g>
      <g className="logo-right">
        <g clipPath={`url(#${clip})`}>
          <Link cx={CX[1]} colour={gap} width={SW + 5} />
          <Link cx={CX[1]} colour="rgb(var(--pb))" />
        </g>
      </g>
    </svg>
  )
}

// The name, set beside the mark.
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={'inline-flex items-center gap-2 ' + className}>
      <Logo className="w-[1.6em]" link="once" />
      <span>Coupled</span>
    </span>
  )
}
