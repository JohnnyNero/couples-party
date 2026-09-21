import { useRef, useState, type PointerEvent } from 'react'
import type { DrawStroke, PlayerId, SessionState } from '../../engine/state'
import { dispatch } from '../../net'
import { CANVAS_ASPECT, DrawingStrokes } from '../../views/DrawingCanvas'
import { playerName } from '../../views/list'
import { PlayWaiting } from './PlayWaiting'

// The drawer's own canvas: pointer events, not the native drag API, for reliable touch
// input. Strokes stay local until "Done" — this isn't a live stream, the finished
// drawing appears all at once for the guesser, same shape as Wavelength's one clue.
export function PlayDrawSketch({ s, me }: { s: SessionState; me: PlayerId }) {
  const d = s.draw!
  const round = d.rounds[d.current]
  const [strokes, setStrokes] = useState<DrawStroke[]>([])
  const drawing = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)

  if (me !== round.drawer) return <PlayWaiting label={`${playerName(s, round.drawer)} is drawing`} />

  const prompt = s.drawPrompts.find((p) => p.id === round.promptId)

  function point(e: PointerEvent<HTMLDivElement>): [number, number] {
    const box = boxRef.current!.getBoundingClientRect()
    return [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height]
  }
  function start(e: PointerEvent<HTMLDivElement>) {
    drawing.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setStrokes((prev) => [...prev, [point(e)]])
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!drawing.current) return
    setStrokes((prev) => {
      const next = prev.map((stroke) => [...stroke])
      next[next.length - 1].push(point(e))
      return next
    })
  }
  function end() { drawing.current = false }

  return (
    <div className="h-full flex flex-col p-5 gap-3">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-1">
          Draw it — nobody sees this but you
        </div>
        <div className="text-xl font-bold uppercase tracking-tight">{prompt?.text ?? '—'}</div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
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
      </div>
      <div className="flex gap-2">
        <button
          className="flex-1 min-h-[48px] rounded-xl border-2 border-fg/30 uppercase tracking-widest active:translate-y-px disabled:opacity-30"
          onClick={() => setStrokes((prev) => prev.slice(0, -1))}
          disabled={strokes.length === 0}
        >
          Undo
        </button>
        <button
          className="flex-[2] min-h-[48px] rounded-xl bg-accent text-bg text-lg font-bold uppercase tracking-widest active:translate-y-px"
          onClick={() => dispatch({ type: 'SUBMIT_DRAWING', player: me, strokes })}
        >
          Done
        </button>
      </div>
    </div>
  )
}
