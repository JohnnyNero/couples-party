import type { DrawStroke } from '../engine/state'

// A fixed aspect ratio everywhere a drawing appears — the sketch pad and every later
// display of the finished result — so nothing looks stretched between the two.
export const CANVAS_ASPECT = 'aspect-[4/3]'

export function DrawingStrokes({ strokes, animate = false }: { strokes: DrawStroke[]; animate?: boolean }) {
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
          // pathLength=1 lets the dash offset be expressed as a 0..1 fraction of the
          // stroke regardless of its real length, so one keyframe animates every stroke.
          pathLength={animate ? 1 : undefined}
          style={
            animate
              ? { strokeDasharray: 1, strokeDashoffset: 1, animation: `draw-in 450ms ease-out ${i * 150}ms forwards` }
              : undefined
          }
        />
      ))}
    </svg>
  )
}

// The finished drawing appearing for the first time (to the guesser) inks itself in,
// stroke by stroke, instead of just popping onto the screen — everywhere else it's
// already been seen once, so it renders plainly.
export function DrawingCanvas({ strokes, animate = false }: { strokes: DrawStroke[]; animate?: boolean }) {
  return (
    <div className={`w-full ${CANVAS_ASPECT} bg-fg/5 border-2 border-fg/25 rounded-2xl overflow-hidden text-fg`}>
      <DrawingStrokes strokes={strokes} animate={animate} />
    </div>
  )
}
