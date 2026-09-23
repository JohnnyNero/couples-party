import type { SessionState } from '../../engine/state'
import { drawAward } from '../../engine/standing'
import { dispatch, useMyPlayerId } from '../../net'
import { DrawingCanvas } from '../../views/DrawingCanvas'
import { drawQuestion } from '../../views/draw'
import { playerName } from '../../views/list'

// The answer, the drawing, the guess. Matching is deliberately strict ("ramen" is not
// "noodles"), so on a miss the drawer — and only the drawer, whose answer it was — gets
// a button to count it anyway. That's the argument this reveal is here to start.
export function ScreenDrawReveal({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const d = s.draw!
  const round = d.rounds[d.current]
  const award = drawAward(round)
  const canCount = me === round.drawer && !round.correct && !!round.guess
  return (
    <div className="w-full max-w-md mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-2 sm:mb-4">
        {drawQuestion(s, round, null)}
      </div>
      <div className="text-2xl sm:text-4xl font-bold uppercase tracking-tight break-words mb-4">
        {round.answer || '—'}
      </div>
      <DrawingCanvas strokes={round.strokes} />
      <div className="mt-5 sm:mt-8 flex items-baseline justify-between gap-4">
        <span className="text-base sm:text-2xl font-bold uppercase tracking-tight truncate">
          Guessed <span className="text-fg/60">"{round.guess || '—'}"</span>
        </span>
        <span className="text-base sm:text-2xl font-bold uppercase tracking-tight text-accent text-right shrink-0 animate-pop">
          {award ? `${playerName(s, award.player)} +${award.points}` : 'Nothing moves'}
        </span>
      </div>
      {canCount && <CountIt me={me} />}
    </div>
  )
}

export function CountIt({ me }: { me: 'A' | 'B' }) {
  return (
    <button
      onClick={() => dispatch({ type: 'COUNT_IT', player: me })}
      className="mt-4 w-full min-h-[48px] rounded-xl border-2 border-accent text-accent font-bold uppercase tracking-widest active:translate-y-px"
    >
      Close enough — count it
    </button>
  )
}
