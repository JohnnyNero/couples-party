import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { DrawStroke, PlayerId, SessionState } from '../../engine/state'
import { DRAW } from '../../engine/phases'
import { dispatch } from '../../net'
import { CANVAS_ASPECT, DrawingStrokes } from '../../views/DrawingCanvas'
import { drawQuestion } from '../../views/draw'
import { playerName } from '../../views/list'
import { PlayWaiting } from './PlayWaiting'

// Two steps on the drawer's phone. First the answer — typed, private, one word — because
// that's what the guess will be checked against, and saying it first stops you drawing
// something you can draw instead of the true answer. Then the canvas: pointer events,
// not the native drag API, for reliable touch input, and nothing leaves the phone until
// "Done".
export function PlayDrawSketch({ s, me }: { s: SessionState; me: PlayerId }) {
  const d = s.draw!
  const round = d.rounds[d.current]
  const [answer, setAnswer] = useState('')
  const [drawingNow, setDrawingNow] = useState(false)
  const [strokes, setStrokes] = useState<DrawStroke[]>([])
  const drawing = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // The answer and the strokes only live on this phone until Done. If the clock runs out
  // first, the reducer's timeout has nothing to go on and the whole round is wasted — so
  // just before it does, send what's there. An answer with half a drawing is still a
  // round; nothing at all isn't.
  const latest = useRef({ answer, strokes })
  latest.current = { answer, strokes }
  const isDrawer = me === round.drawer
  useEffect(() => {
    if (!isDrawer || s.phaseEndsAt == null) return
    const wait = s.phaseEndsAt - Date.now() - 600
    const id = setTimeout(() => {
      const { answer: a, strokes: st } = latest.current
      if (a.trim()) dispatch({ type: 'SUBMIT_DRAWING', player: me, answer: a, strokes: st })
    }, Math.max(0, wait))
    return () => clearTimeout(id)
  }, [isDrawer, s.phaseEndsAt, me])

  if (!isDrawer) return <PlayWaiting label={`${playerName(s, round.drawer)} is drawing`} />

  const question = drawQuestion(s, round, me)

  if (!drawingNow) {
    const go = () => { if (answer.trim()) setDrawingNow(true) }
    return (
      <div className="h-full flex flex-col justify-center p-6 gap-4">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">Your question</div>
        <div className="text-3xl font-bold uppercase tracking-tight break-words">{question}</div>
        <div className="text-sm text-fg/70 leading-snug">
          Answer it for real, in a word or two — only you see this. Then you draw it, and
          they have to guess what you said.
        </div>
        <input
          className="w-full min-h-[56px] text-xl uppercase bg-ink text-paper px-4 outline-none border-b-4 border-accent placeholder:text-paper/30 placeholder:normal-case rounded-t-xl"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') go() }}
          maxLength={DRAW.guessMaxLen}
          placeholder="your answer"
          autoFocus
          autoComplete="off"
        />
        <button
          className="w-full min-h-[56px] rounded-xl bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px disabled:opacity-40"
          onClick={go}
          disabled={!answer.trim()}
        >
          Now draw it
        </button>
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
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-1 truncate">
          {question} · no words, no letters
        </div>
        <div className="text-xl font-bold uppercase tracking-tight">
          Drawing: <span className="text-accent">{answer.trim()}</span>
        </div>
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
          onClick={() => dispatch({ type: 'SUBMIT_DRAWING', player: me, answer, strokes })}
        >
          Done
        </button>
      </div>
    </div>
  )
}
