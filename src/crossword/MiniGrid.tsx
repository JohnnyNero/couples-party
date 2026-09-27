import { at } from '../ui/fx'

// A grid in miniature: only colours, never letters. `deal` has the squares land one by
// one, for a new week's first sight of it.
export function MiniGrid({ w, h, squares, whose, size = 132, deal = false }: {
  w: number; h: number; squares: string[]; whose: (k: string) => boolean | undefined; size?: number; deal?: boolean
}) {
  const cell = Math.min(12, Math.floor(size / Math.max(w, h, 1)))
  return (
    <div className="shrink-0 relative" style={{ width: cell * w, height: cell * h }} aria-hidden="true">
      {squares.map((k) => {
        const [r, c] = k.split(',').map(Number)
        const mine = whose(k)
        return (
          <span
            key={k}
            className={'absolute rounded-[2px] ' + (mine === undefined ? 'bg-fg/15' : mine ? 'bg-pa' : 'bg-pb') + (deal ? ' animate-pop' : '')}
            style={{ left: c * cell, top: r * cell, width: cell - 1.5, height: cell - 1.5, ...(deal ? at((r + c) * 35) : {}) }}
          />
        )
      })}
    </div>
  )
}
