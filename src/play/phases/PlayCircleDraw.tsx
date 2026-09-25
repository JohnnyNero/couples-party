import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { DrawStroke, PlayerId, SessionState } from '../../engine/state'
import { dispatch } from '../../net'
import { DrawingStrokes } from '../../views/DrawingCanvas'
import { playerName } from '../../views/list'
import { other } from '../../engine/state'

// One circle, one go: lifting your finger sends it. The pad is square so a circle stays
// a circle once it's scaled to 0..1 — on a 4:3 pad it would be scored as an oval.
export function PlayCircleDraw({ s, me }: { s: SessionState; me: PlayerId }) {
  const c = s.circle!
  const round = c.rounds[c.current]
  const sent = round.drawn[me]
  const [stroke, setStroke] = useState<DrawStroke>([])
  const drawing = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Still drawing when the clock runs out: send what's there rather than nothing.
  const latest = useRef(stroke)
  latest.current = stroke
  useEffect(() => {
    if (sent || s.phaseEndsAt == null) return
    const id = setTimeout(() => {
      if (latest.current.length > 1) dispatch({ type: 'SUBMIT_CIRCLE', player: me, strokes: [latest.current] })
    }, Math.max(0, s.phaseEndsAt - Date.now() - 500))
    return () => clearTimeout(id)
  }, [sent, s.phaseEndsAt, me])

  if (sent) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 gap-5 text-center">
        <div className="w-full max-w-[16rem] aspect-square bg-fg/5 border-2 border-fg/25 rounded-2xl text-fg">
          <DrawingStrokes strokes={[sent]} />
        </div>
        <div className="text-lg uppercase tracking-wide text-fg/55">
          Sent · waiting for {playerName(s, other(me))}
        </div>
      </div>
    )
  }

  function point(e: PointerEvent<HTMLDivElement>): [number, number] {
    const box = boxRef.current!.getBoundingClientRect()
    return [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height]
  }
  function start(e: PointerEvent<HTMLDivElement>) {
    drawing.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    latest.current = [point(e)]
    setStroke(latest.current)
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!drawing.current) return
    latest.current = [...latest.current, point(e)]
    setStroke(latest.current)
  }
  function end() {
    if (!drawing.current) return
    drawing.current = false
    // A stray tap isn't your go — only an actual line gets sent.
    if (latest.current.length < 6) {
      latest.current = []
      return setStroke([])
    }
    dispatch({ type: 'SUBMIT_CIRCLE', player: me, strokes: [latest.current] })
  }

  return (
    <div className="h-full flex flex-col p-5 gap-3">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-1">
          Perfect Circle{c.bestOf > 1 ? ` · round ${round.index}` : ''}
        </div>
        <div className="text-xl font-bold uppercase tracking-tight">Draw a perfect circle</div>
        <div className="text-sm text-fg/60">One go — lifting your finger sends it</div>
      </div>
      {/* The pad is the largest square that fits, whichever way the phone is held. */}
      <div className="flex-1 min-h-0 flex items-center justify-center" style={{ containerType: 'size' }}>
        <div
          ref={boxRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          style={{ width: 'min(100cqw, 100cqh)', height: 'min(100cqw, 100cqh)' }}
          className="bg-fg/5 border-2 border-fg/25 rounded-2xl touch-none overflow-hidden text-fg"
        >
          <DrawingStrokes strokes={stroke.length ? [stroke] : []} />
        </div>
      </div>
    </div>
  )
}
