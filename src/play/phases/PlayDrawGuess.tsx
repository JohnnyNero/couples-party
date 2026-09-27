import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { DrawRound, DrawStroke, PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { DRAW } from '../../engine/phases'
import { dispatch, useLive } from '../../net'
import { CANVAS_ASPECT, DrawingStrokes, PAPER } from '../../views/DrawingCanvas'
import { drawQuestion } from '../../views/draw'
import { playerName } from '../../views/list'
import { useLiveSender } from '../../views/useLiveSender'
import { inkOf } from '../../ui/Avatar'
import { btnOutline, eyebrow, field } from '../../ui/styles'
import { KeyField, Keys } from '../../ui/keys'

// Drawing, live: the drawer draws against the clock and every stroke turns up on the
// other phone as it's drawn. The guesser has five goes while it comes together — the
// sooner they get it, the more it's worth — and the drawer sees each guess land.

const liveKey = (s: SessionState) => `drawlive:${s.seed}:${s.draw!.current}`
const r3 = (n: number) => Math.round(n * 1000) / 1000

export function PlayDrawGuess({ s, me }: { s: SessionState; me: PlayerId }) {
  const round = s.draw!.rounds[s.draw!.current]
  return round.drawer === me ? <Drawer s={s} me={me} round={round} /> : <Guesser s={s} me={me} round={round} />
}

function Drawer({ s, me, round }: { s: SessionState; me: PlayerId; round: DrawRound }) {
  // Kept here as you draw, and sent as each stroke's finished; the one under your finger
  // goes over the live preview so they see it being drawn.
  const [strokes, setStrokes] = useState<DrawStroke[]>(() => round.strokes)
  const [current, setCurrent] = useState<DrawStroke | null>(null)
  const drawing = useRef<DrawStroke | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const send = useLiveSender(liveKey(s))
  const guesses = round.guesses ?? []

  const point = (e: PointerEvent<HTMLDivElement>): [number, number] => {
    const b = box.current!.getBoundingClientRect()
    return [r3((e.clientX - b.left) / b.width), r3((e.clientY - b.top) / b.height)]
  }
  const commit = (next: DrawStroke[]) => {
    setStrokes(next)
    dispatch({ type: 'DRAW_STROKES', player: me, strokes: next })
  }
  const start = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = [point(e)]
    setCurrent(drawing.current)
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const stroke = drawing.current
    if (!stroke) return
    const [x, y] = point(e)
    const [px, py] = stroke[stroke.length - 1]
    if (Math.hypot(x - px, y - py) < 0.004) return
    drawing.current = [...stroke, [x, y]]
    setCurrent(drawing.current)
    send(JSON.stringify(drawing.current))
  }
  const end = () => {
    const stroke = drawing.current
    drawing.current = null
    setCurrent(null)
    send('')
    if (stroke && stroke.length > 0) commit([...strokes, stroke])
  }

  return (
    <div className="h-full flex flex-col px-5 pb-5 gap-3">
      <div>
        <div className={eyebrow + ' truncate'}>{drawQuestion(s, round, me)} · no words, no letters</div>
        <div className="font-display text-2xl font-extrabold leading-tight break-words">
          Drawing: <span className="text-accent-ink">{round.answer}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          ref={box}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          data-activity="drawing"
          className={`w-full ${CANVAS_ASPECT} ${PAPER} touch-none relative`}
          style={{ maxWidth: 'calc((100dvh - 330px) * 4 / 3)' }}
        >
          <DrawingStrokes strokes={current ? [...strokes, current] : strokes} />
        </div>
      </div>
      <Guesses s={s} round={round} guesser={other(me)} />
      <div className="flex gap-2.5">
        <button className={btnOutline + ' !w-auto flex-1'} onClick={() => commit(strokes.slice(0, -1))} disabled={strokes.length === 0}>
          Undo
        </button>
        <div className="flex-[2] self-center text-center text-sm font-bold text-fg/60">
          {DRAW.maxGuesses - guesses.length} {DRAW.maxGuesses - guesses.length === 1 ? 'guess' : 'guesses'} left for {playerName(s, other(me))}
        </div>
      </div>
    </div>
  )
}

function Guesser({ s, me, round }: { s: SessionState; me: PlayerId; round: DrawRound }) {
  const [text, setText] = useState('')
  const live = useLive(liveKey(s))
  const inProgress = useMemo<DrawStroke | null>(() => {
    if (typeof live !== 'string' || !live) return null
    try { return JSON.parse(live) as DrawStroke } catch { return null }
  }, [live])
  const guesses = round.guesses ?? []
  const left = DRAW.maxGuesses - guesses.length
  // A guess that didn't land: the box empties once it's in, ready for the next.
  const sent = useRef<string | null>(null)
  useEffect(() => {
    if (sent.current && guesses.some((g) => g.toLowerCase() === sent.current!.toLowerCase())) {
      sent.current = null
      setText('')
    }
  }, [guesses])

  const guess = () => {
    const t = text.trim()
    if (!t || left <= 0) return
    sent.current = t
    dispatch({ type: 'SUBMIT_DRAW_GUESS', player: me, text: t })
  }

  return (
    <Keys className="h-full" bodyClassName="px-5 pb-3 gap-3">
      <div>
        <div className={eyebrow + ' text-accent-ink'}>What did {playerName(s, round.drawer)} say?</div>
        <div className="mt-0.5 font-display text-xl font-extrabold leading-tight break-words">{drawQuestion(s, round, me)}</div>
      </div>
      <div className="flex justify-center">
        <div className={`w-full ${CANVAS_ASPECT} ${PAPER} relative`} style={{ maxWidth: 'calc(34dvh * 4 / 3)' }}>
          <DrawingStrokes strokes={inProgress ? [...round.strokes, inProgress] : round.strokes} />
          {round.strokes.length === 0 && !inProgress && (
            <div className="absolute inset-0 grid place-items-center text-sm font-bold text-fg/35">{playerName(s, round.drawer)} is about to start…</div>
          )}
        </div>
      </div>
      <Guesses s={s} round={round} guesser={me} />
      <KeyField
        className={field}
        value={text}
        onChange={setText}
        onEnter={guess}
        enter={left === 1 ? 'Last go' : `Guess · ${left}`}
        canEnter={!!text.trim() && left > 0}
        maxLength={DRAW.guessMaxLen}
        placeholder={guesses.length === 0 ? 'your guess' : 'another guess'}
        autoFocus
      />
    </Keys>
  )
}

// The guesses so far, each crossed through — the newest gives a shake as it lands.
function Guesses({ s, round, guesser }: { s: SessionState; round: DrawRound; guesser: PlayerId }) {
  const guesses = round.guesses ?? []
  if (guesses.length === 0) {
    return <div className="text-center text-sm font-bold text-fg/45">{DRAW.maxGuesses} guesses for {playerName(s, guesser)} — the sooner, the more it’s worth</div>
  }
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {guesses.map((g, i) => (
        <span
          key={i}
          className={'px-3 py-1 rounded-full bg-fg/[0.07] text-sm font-extrabold line-through decoration-2 ' + inkOf(guesser) + (i === guesses.length - 1 ? ' animate-wiggle' : '')}
        >
          {g}
        </span>
      ))}
    </div>
  )
}
