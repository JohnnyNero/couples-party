import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { DrawingCanvas } from '../../views/DrawingCanvas'
import { playerName } from '../../views/list'
import { drawQuestion } from '../../views/draw'
import { useMyPlayerId } from '../../net'
import { Doing } from '../../ui/kit'
import { eyebrow } from '../../ui/styles'

// The finished drawing is public now — everyone in the room can see it. Only the guess
// itself stays private until the reveal.
export function ScreenDrawGuess({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const d = s.draw!
  const round = d.rounds[d.current]
  const guesser = other(round.drawer)
  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 text-center">
      <div>
        <div className={eyebrow + ' text-accent-ink'}>{playerName(s, round.drawer)} drew their answer to</div>
        <div className="mt-1 font-display text-2xl sm:text-4xl font-extrabold leading-tight break-words">{drawQuestion(s, round, me)}</div>
      </div>
      <DrawingCanvas strokes={round.strokes} animate />
      <Doing s={s} p={guesser} finished={round.guess !== null} busy={`${playerName(s, guesser)} is guessing…`} done="Guess is in" />
    </div>
  )
}
