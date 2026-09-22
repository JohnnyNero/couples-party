import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { DRAW } from '../../engine/phases'
import { dispatch } from '../../net'
import { DrawingCanvas } from '../../views/DrawingCanvas'
import { PlayWaiting } from './PlayWaiting'

export function PlayDrawGuess({ s, me }: { s: SessionState; me: PlayerId }) {
  const d = s.draw!
  const round = d.rounds[d.current]
  const guesser = other(round.drawer)
  const [text, setText] = useState('')

  if (me !== guesser) return <PlayWaiting label="They're guessing" />
  if (round.guess !== null) return <PlayWaiting label="Locked in — waiting" />

  const submit = () => {
    const t = text.trim()
    if (t.length === 0) return
    dispatch({ type: 'SUBMIT_DRAW_GUESS', player: me, text: t })
  }

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">What is it?</div>
      <DrawingCanvas strokes={round.strokes} animate />
      <input
        className="w-full min-h-[56px] text-xl uppercase bg-fg text-bg px-4 outline-none border-b-4 border-accent placeholder:text-bg/30 placeholder:normal-case rounded-t-xl"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        maxLength={DRAW.guessMaxLen}
        placeholder="your guess"
        autoFocus
        autoComplete="off"
      />
      <button
        className="w-full min-h-[56px] rounded-xl bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={submit}
      >
        Lock in my guess
      </button>
    </div>
  )
}
