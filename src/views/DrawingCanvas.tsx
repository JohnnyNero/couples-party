import type { DrawStroke } from '../engine/state'

// A fixed aspect ratio everywhere a drawing appears — the sketch pad and every later
// display of the finished result — so nothing looks stretched between the two.
export const CANVAS_ASPECT = 'aspect-[4/3]'

export function DrawingStrokes({ strokes }: { strokes: DrawStroke[] }) {
  return (
    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {strokes.map((stroke, i) => (
        <polyline
          key={i}
          points={stroke.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

export function DrawingCanvas({ strokes }: { strokes: DrawStroke[] }) {
  return (
    <div className={`w-full ${CANVAS_ASPECT} bg-fg/5 border-2 border-fg/25 rounded-2xl overflow-hidden text-fg`}>
      <DrawingStrokes strokes={strokes} />
    </div>
  )
}
