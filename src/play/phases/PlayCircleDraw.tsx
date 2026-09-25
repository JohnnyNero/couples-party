import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { DrawStroke, PlayerId, SessionState } from '../../engine/state'
import { dispatch } from '../../net'
import { DrawingStrokes } from '../../views/DrawingCanvas'
import { playerName } from '../../views/list'
import { other } from '../../engine/state'
import { inkOf } from '../../ui/Avatar'
import { Waiting } from '../../ui/kit'

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
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className={'w-full max-w-[14rem] aspect-square bg-card border-2 border-fg/20 rounded-3xl ' + inkOf(me)}>
          <DrawingStrokes strokes={[sent]} />
        </div>
        <div className="h-40"><Waiting title="Sent" sub={`Waiting for ${playerName(s, other(me))}`} /></div>
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
    <div className="h-full flex flex-col px-5 pb-6 gap-3">
      <div className="text-center">
        <div className="font-display text-3xl font-extrabold leading-tight">Draw a perfect circle</div>
        <div className="text-sm font-bold text-fg/55">One go — lifting your finger sends it</div>
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
          className={'bg-card border-2 border-fg rounded-3xl touch-none overflow-hidden shadow-[4px_4px_0_rgba(0,0,0,0.12)] ' + inkOf(me)}
        >
          <DrawingStrokes strokes={stroke.length ? [stroke] : []} />
        </div>
      </div>
    </div>
  )
}
