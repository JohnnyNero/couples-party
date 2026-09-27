import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { DRAW } from '../../engine/phases'
import { dispatch } from '../../net'
import { drawQuestion } from '../../views/draw'
import { playerName } from '../../views/list'
import { eyebrow, field } from '../../ui/styles'
import { PromptCard } from '../../ui/kit'
import { KeyField, Keys } from '../../ui/keys'
import { PlayWaiting } from './PlayWaiting'

// Your turn to draw starts with your answer — typed, private, a word or two — because
// that's what their guesses are checked against, and saying it first stops you drawing
// something easier to draw instead. Then the clock starts and they watch you draw it.
export function PlayDrawSketch({ s, me }: { s: SessionState; me: PlayerId }) {
  const d = s.draw!
  const round = d.rounds[d.current]
  const [answer, setAnswer] = useState('')
  const them = other(me)

  if (round.drawer !== me) {
    return <PlayWaiting label={`${playerName(s, them)} is deciding what to draw`} sub={`${drawQuestion(s, round, me)} — get ready to guess.`} />
  }
  if (round.answer !== null) return <PlayWaiting label="Get ready to draw" />

  const go = () => { if (answer.trim()) dispatch({ type: 'PICK_DRAW_ANSWER', player: me, answer }) }
  return (
    <Keys className="h-full" bodyClassName="px-5 pb-3">
      <div className="flex-1 flex flex-col justify-center gap-4">
        <PromptCard over="Your question" size="md">{drawQuestion(s, round, me)}</PromptCard>
        <div className="text-sm text-fg/70 leading-snug">
          Answer it for real, in a word or two — only you see this. Then you draw it against the
          clock while {playerName(s, them)} watches and gets {DRAW.maxGuesses} guesses.
        </div>
        <div className={eyebrow}>No words or letters in the drawing</div>
      </div>
      <KeyField
        className={field}
        value={answer}
        onChange={setAnswer}
        onEnter={go}
        enter="Draw it"
        canEnter={!!answer.trim()}
        maxLength={DRAW.guessMaxLen}
        placeholder="your answer"
        autoFocus
      />
    </Keys>
  )
}
