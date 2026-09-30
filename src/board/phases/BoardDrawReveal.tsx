import { shown as scaled } from '../../engine/standing'
import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { drawAward } from '../../engine/standing'
import { dispatch, useMyPlayerId } from '../../net'
import { DrawingCanvas } from '../../views/DrawingCanvas'
import { drawQuestion } from '../../views/draw'
import { playerName } from '../../views/list'
import { inkOf } from '../../ui/Avatar'
import { eyebrow } from '../../ui/styles'
import { Burst, at, verdictFx } from '../../ui/fx'
import { ReplayButton } from '../../share/ReplayButton'
import { drawingReplay } from '../../share/replay'

// The answer, the drawing, and every guess at it — the one that got it, and on which
// go. Matching is deliberately strict ("ramen" is not "noodles"), so on a miss the
// drawer — and only the drawer, whose answer it was — can tap a guess to count it
// anyway. That's the argument this reveal is here to start.
export function BoardDrawReveal({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const d = s.draw!
  const round = d.rounds[d.current]
  const award = drawAward(round)
  const guesser = other(round.drawer)
  const guesses = round.guesses ?? (round.guess ? [round.guess] : [])
  const canCount = me === round.drawer && !round.correct && guesses.length > 0 && !!round.answer
  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 text-center">
      <div>
        <div className={eyebrow}>{drawQuestion(s, round, me)}</div>
        <div className={'mt-1 font-display text-3xl sm:text-5xl font-extrabold leading-tight break-words animate-pop ' + inkOf(round.drawer)}>
          {round.answer || '—'}
        </div>
      </div>
      <DrawingCanvas strokes={round.strokes} />
      {guesses.length === 0 ? (
        <div className="font-bold text-fg/50">{playerName(s, guesser)} didn’t guess</div>
      ) : (
        <div className="flex flex-wrap justify-center gap-1.5">
          {guesses.map((g, i) => {
            const hit = round.correct && round.hitAt === i + 1
            const chip = 'px-3 py-1 rounded-full text-sm font-extrabold ' + (hit ? 'bg-sage-soft text-sage-ink animate-pop' : 'bg-fg/[0.07] line-through decoration-2 ' + inkOf(guesser))
            return canCount ? (
              <button key={i} onClick={() => dispatch({ type: 'COUNT_IT', player: me!, index: i })} className={chip + ' press'} title="Count this one">
                {g}
              </button>
            ) : (
              <span key={i} style={at(300 + i * 120)} className={chip}>{hit ? `${g} ✓ · go ${i + 1}` : g}</span>
            )
          })}
        </div>
      )}
      <div className="relative">
        {award && <Burst delay={1000} />}
        {award ? (
          <span style={at(900)} className={'inline-block rounded-full bg-sage-soft text-sage-ink px-4 py-1.5 font-display text-xl sm:text-2xl font-extrabold ' + verdictFx(true)}>
            Got it! · {playerName(s, award.player)} +{scaled(s, 'draw', award.points)}
          </span>
        ) : (
          <span style={at(900)} className={'inline-block rounded-full bg-fg/10 text-fg/60 px-4 py-1.5 font-display text-xl sm:text-2xl font-extrabold ' + verdictFx(false)}>
            Not this time
          </span>
        )}
      </div>
      {canCount && <div className="text-sm font-bold text-fg/60">Near enough? Tap the guess to count it.</div>}
      {/* The drawing, redrawn as a GIF to send — with what it was, and the guess. */}
      {me !== null && round.strokes.length > 0 && (
        <ReplayButton
          label="Make a replay"
          make={() => drawingReplay({
            strokes: round.strokes,
            drawer: round.drawer,
            title: `${playerName(s, round.drawer)}’s drawing`,
            answer: round.answer ?? '',
            guess: round.guess,
            guesser: playerName(s, guesser),
          })}
        />
      )}
    </div>
  )
}

