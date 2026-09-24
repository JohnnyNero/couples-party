import { useRef, type PointerEvent } from 'react'
import type { DrawStroke } from '../engine/state'
import { CANVAS_ASPECT, DrawingStrokes } from '../views/DrawingCanvas'

// A drawing surface for the daily Sketch — the same pointer handling and canvas shape as
// the live game's sketch pad (PlayDrawSketch), minus the session plumbing. The caller
// owns the strokes, so Undo and sending live wherever the rest of the screen does.
export function SketchPad({
  strokes,
  onChange,
  disabled = false,
}: {
  strokes: DrawStroke[]
  onChange: (next: DrawStroke[]) => void
  disabled?: boolean
}) {
  const drawing = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const latest = useRef(strokes)
  latest.current = strokes

  function point(e: PointerEvent<HTMLDivElement>): [number, number] {
    const box = boxRef.current!.getBoundingClientRect()
    return [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height]
  }
  function start(e: PointerEvent<HTMLDivElement>) {
    if (disabled) return
    drawing.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange([...latest.current, [point(e)]])
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!drawing.current) return
    const next = latest.current.map((s) => [...s])
    next[next.length - 1].push(point(e))
    onChange(next)
  }
  function end() { drawing.current = false }

  return (
    <div
      ref={boxRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={`w-full ${CANVAS_ASPECT} bg-fg/5 border-2 border-fg/25 rounded-2xl touch-none relative overflow-hidden text-fg`}
    >
      <DrawingStrokes strokes={strokes} />
    </div>
  )
}
