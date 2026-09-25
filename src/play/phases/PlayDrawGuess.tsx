import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { DRAW } from '../../engine/phases'
import { dispatch } from '../../net'
import { DrawingCanvas } from '../../views/DrawingCanvas'
import { drawQuestion } from '../../views/draw'
import { playerName } from '../../views/list'
import { btnAccent, eyebrow, field } from '../../ui/styles'
import { PlayWaiting } from './PlayWaiting'

export function PlayDrawGuess({ s, me }: { s: SessionState; me: PlayerId }) {
  const d = s.draw!
  const round = d.rounds[d.current]
  const guesser = other(round.drawer)
  const [text, setText] = useState('')

  if (me !== guesser) return <PlayWaiting label={`${playerName(s, guesser)} is guessing`} sub="Don’t give it away." />
  if (round.guess !== null) return <PlayWaiting label="Locked in" sub="Let’s see…" />

  const submit = () => {
    const t = text.trim()
    if (t.length === 0) return
    dispatch({ type: 'SUBMIT_DRAW_GUESS', player: me, text: t })
  }

  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div>
          <div className={eyebrow + ' text-accent-ink'}>What did {playerName(s, round.drawer)} say?</div>
          <div className="mt-1 font-display text-2xl font-extrabold leading-tight break-words">{drawQuestion(s, round, me)}</div>
        </div>
        <DrawingCanvas strokes={round.strokes} animate />
      </div>
      <div className="flex flex-col gap-2.5 pt-3">
        <input
          className={field}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          maxLength={DRAW.guessMaxLen}
          placeholder="your guess"
          autoFocus
          autoComplete="off"
        />
        <button className={btnAccent} onClick={submit} disabled={text.trim().length === 0}>
          Lock in my guess
        </button>
      </div>
    </div>
  )
}
