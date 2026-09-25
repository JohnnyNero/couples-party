import { useRef } from 'react'
import type { PlayerId } from '../engine/state'

// The Wavelength scale as a half dial: low on the left, high on the right. The hidden
// mark shows as scoring bands in the clue-giver's colour (bullseye, close, near — the
// same distances waveAward scores), the guess as a needle in the guesser's. Hand it
// `onChange` and the dial is the input: drag anywhere on it to swing the needle.

const W = 300
const CX = 150
const CY = 160
const R = 135

const rgb = (v: string, a = 1) => `rgb(var(${v}) / ${a})`
const colours = (p: PlayerId) => (p === 'A' ? ['--pa', '--pa-soft'] : ['--pb', '--pb-soft'])

function point(v: number, r = R): [number, number] {
  const t = Math.PI * (1 - v / 100)
  return [CX + r * Math.cos(t), CY - r * Math.sin(t)]
}

function wedge(from: number, to: number): string {
  const a = Math.max(0, from)
  const b = Math.min(100, to)
  const [x1, y1] = point(a)
  const [x2, y2] = point(b)
  return `M${CX} ${CY} L${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`
}

export function WaveDial({
  low,
  high,
  target,
  guess,
  marker = 'A',
  guesser = 'B',
  reveal = false,
  onChange,
}: {
  low: string
  high: string
  // Only passed to whoever may see it: the clue-giver while writing, everyone at reveal.
  target?: number | null
  guess?: number | null
  marker?: PlayerId
  guesser?: PlayerId
  // The bands' entrance — the reveal moment only, not the clue-giver's private view.
  reveal?: boolean
  onChange?: (v: number) => void
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [full, soft] = colours(marker)
  const [needle] = colours(guesser)

  const read = (e: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box || !onChange) return
    const x = ((e.clientX - box.left) / box.width) * W - CX
    const y = CY - ((e.clientY - box.top) / box.width) * W
    const t = Math.atan2(Math.max(y, 0), x)
    onChange(Math.round(100 * (1 - t / Math.PI)))
  }

  const [nx, ny] = guess != null ? point(guess, R - 12) : [0, 0]
  return (
    <div className="w-full max-w-[26rem] mx-auto">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} 172`}
        className={'w-full select-none ' + (onChange ? 'touch-none cursor-pointer' : '')}
        onPointerDown={(e) => { if (!onChange) return; (e.target as Element).setPointerCapture?.(e.pointerId); read(e) }}
        onPointerMove={(e) => { if (onChange && e.buttons) read(e) }}
        role={onChange ? 'slider' : 'img'}
        aria-label={`${low} to ${high}`}
        aria-valuenow={onChange ? guess ?? undefined : undefined}
      >
        {/* Colours go in `style`: a CSS variable isn't read in an SVG attribute. */}
        <path d={wedge(0, 100)} style={{ fill: rgb('--card') }} />
        {target != null && (
          <g className={reveal ? 'animate-pop' : ''} style={{ transformOrigin: `${CX}px ${CY}px` }}>
            <path d={wedge(target - 15, target + 15)} style={{ fill: rgb(soft) }} />
            <path d={wedge(target - 5, target + 5)} style={{ fill: rgb(full, 0.5) }} />
            <path d={wedge(target - 1, target + 1)} style={{ fill: rgb(full) }} />
          </g>
        )}
        {/* tick marks every tenth, so the dial reads as a scale */}
        {Array.from({ length: 9 }, (_, i) => {
          const [x1, y1] = point((i + 1) * 10, R - 6)
          const [x2, y2] = point((i + 1) * 10, R)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: rgb('--fg', 0.25) }} strokeWidth={2} strokeLinecap="round" />
        })}
        <path d={wedge(0, 100)} fill="none" style={{ stroke: rgb('--fg') }} strokeWidth={2.5} strokeLinejoin="round" />
        {guess != null && (
          <line
            x1={CX}
            y1={CY}
            x2={nx}
            y2={ny}
            strokeWidth={6}
            strokeLinecap="round"
            className={reveal ? 'animate-fade-up' : ''}
            style={{ stroke: rgb(needle), ...(reveal ? { animationDelay: '500ms' } : {}) }}
          />
        )}
        <circle cx={CX} cy={CY} r={9} style={{ fill: rgb('--fg') }} />
      </svg>
      <div className="mt-1 flex justify-between gap-4 text-sm sm:text-lg font-extrabold leading-tight">
        <span>{low}</span>
        <span className="text-right">{high}</span>
      </div>
    </div>
  )
}
