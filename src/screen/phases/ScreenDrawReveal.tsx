import { shown as scaled } from '../../engine/standing'
import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { drawAward } from '../../engine/standing'
import { dispatch, useMyPlayerId } from '../../net'
import { DrawingCanvas } from '../../views/DrawingCanvas'
import { drawQuestion } from '../../views/draw'
import { playerName } from '../../views/list'
import { Said } from '../../ui/kit'
import { inkOf } from '../../ui/Avatar'
import { btnOutline, eyebrow } from '../../ui/styles'

// The answer, the drawing, the guess. Matching is deliberately strict ("ramen" is not
// "noodles"), so on a miss the drawer — and only the drawer, whose answer it was — gets
// a button to count it anyway. That's the argument this reveal is here to start.
export function ScreenDrawReveal({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const d = s.draw!
  const round = d.rounds[d.current]
  const award = drawAward(round)
  const guesser = other(round.drawer)
  const canCount = me === round.drawer && !round.correct && !!round.guess && !!round.answer
  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 text-center">
      <div>
        <div className={eyebrow}>{drawQuestion(s, round, me)}</div>
        <div className={'mt-1 font-display text-3xl sm:text-5xl font-extrabold leading-tight break-words animate-pop ' + inkOf(round.drawer)}>
          {round.answer || '—'}
        </div>
      </div>
      <DrawingCanvas strokes={round.strokes} />
      {round.guess ? <Said s={s} p={guesser}>{round.guess}</Said> : <div className="font-bold text-fg/50">{playerName(s, guesser)} didn’t guess</div>}
      <div className="animate-fade-up" style={{ animationDelay: '400ms' }}>
        {award ? (
          <span className="inline-block rounded-full bg-sage-soft text-sage-ink px-4 py-1.5 font-display text-xl sm:text-2xl font-extrabold">
            Got it! · {playerName(s, award.player)} +{scaled(s, 'draw', award.points)}
          </span>
        ) : (
          <span className="inline-block rounded-full bg-fg/10 text-fg/60 px-4 py-1.5 font-display text-xl sm:text-2xl font-extrabold">
            Not this time
          </span>
        )}
      </div>
      {canCount && <CountIt me={me} />}
    </div>
  )
}

export function CountIt({ me }: { me: 'A' | 'B' }) {
  return (
    <button onClick={() => dispatch({ type: 'COUNT_IT', player: me })} className={btnOutline}>
      Close enough — count it
    </button>
  )
}
