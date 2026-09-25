import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { DrawStroke, PlayerId, SessionState } from '../../engine/state'
import { DRAW } from '../../engine/phases'
import { dispatch } from '../../net'
import { CANVAS_ASPECT, DrawingStrokes, PAPER } from '../../views/DrawingCanvas'
import { drawQuestion } from '../../views/draw'
import { playerName } from '../../views/list'
import { btnAccent, btnOutline, eyebrow, field } from '../../ui/styles'
import { PromptCard } from '../../ui/kit'
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

  if (!isDrawer) return <PlayWaiting label={`${playerName(s, round.drawer)} is drawing`} sub="No peeking." />

  const question = drawQuestion(s, round, me)

  if (!drawingNow) {
    const go = () => { if (answer.trim()) setDrawingNow(true) }
    return (
      <div className="h-full flex flex-col px-5 pb-6">
        <div className="flex-1 flex flex-col justify-center gap-4">
          <PromptCard over="Your question" size="md">{question}</PromptCard>
          <div className="text-sm text-fg/70 leading-snug">
            Answer it for real, in a word or two — only you see this. Then you draw it, and
            they have to guess what you said.
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <input
            className={field}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') go() }}
            maxLength={DRAW.guessMaxLen}
            placeholder="your answer"
            autoFocus
            autoComplete="off"
          />
          <button className={btnAccent} onClick={go} disabled={!answer.trim()}>
            Now draw it
          </button>
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
    <div className="h-full flex flex-col px-5 pb-6 gap-3">
      <div>
        <div className={eyebrow + ' truncate'}>{question} · no words, no letters</div>
        <div className="font-display text-2xl font-extrabold leading-tight">
          Drawing: <span className="text-accent-ink">{answer.trim()}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          ref={boxRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className={`w-full ${CANVAS_ASPECT} ${PAPER} touch-none relative`}
        >
          <DrawingStrokes strokes={strokes} />
        </div>
      </div>
      <div className="flex gap-2.5">
        <button
          className={btnOutline + ' !w-auto flex-1'}
          onClick={() => setStrokes((prev) => prev.slice(0, -1))}
          disabled={strokes.length === 0}
        >
          Undo
        </button>
        <button
          className={btnAccent + ' !w-auto flex-[2]'}
          onClick={() => dispatch({ type: 'SUBMIT_DRAWING', player: me, answer, strokes })}
        >
          Done
        </button>
      </div>
    </div>
  )
}
