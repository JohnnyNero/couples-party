import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { mrmrsRoundPoints } from '../../engine/standing'
import { dispatch, useMyPlayerId } from '../../net'
import { playerName } from '../../views/list'

const ORDER: PlayerId[] = ['A', 'B']

// One card per person: what they said, and what the other guessed they'd say. The
// person the answer belongs to rules on it — exact matches and blanks are called for
// them, so the buttons only appear on a genuine "close enough?". The card waits for
// both rulings; nothing is timed until then.
export function ScreenMmJudge({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const g = s.mrmrs!
  const round = g.rounds[g.current]
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-3 sm:gap-5">
      <div className="text-center text-base sm:text-2xl font-bold uppercase tracking-tight break-words">
        {round.question}
      </div>
      {ORDER.map((subject, i) => {
        const predictor = other(subject)
        const verdict = round.verdict[predictor]
        const points = mrmrsRoundPoints(round, predictor)
        return (
          <div
            key={subject}
            style={{ animationDelay: `${i * 250}ms` }}
            className="rounded-2xl border-2 border-fg/15 p-3 sm:p-5 animate-fade-up"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/45">
                {playerName(s, subject)} said
              </span>
              <span className="text-lg sm:text-2xl font-bold uppercase tracking-tight text-right break-words min-w-0">
                {round.answer[subject] ?? '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 mt-1">
              <span className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/45">
                {playerName(s, predictor)} guessed
              </span>
              <span className="text-lg sm:text-2xl font-bold uppercase tracking-tight text-right text-fg/60 break-words min-w-0">
                {round.predict[predictor] ?? '—'}
              </span>
            </div>
            <div className="mt-2 sm:mt-3 flex justify-end">
              {verdict === null ? (
                me === subject ? (
                  <Judge me={me} />
                ) : (
                  <span className="text-xs sm:text-sm uppercase tracking-widest text-fg/40">
                    {playerName(s, subject)} is deciding…
                  </span>
                )
              ) : (
                <span
                  className={
                    'text-sm sm:text-xl font-bold uppercase tracking-tight animate-reveal-pop ' +
                    (verdict ? 'text-accent' : 'text-fg/40')
                  }
                >
                  {verdict ? `Got it · ${playerName(s, predictor)} +${points}` : 'Not quite'}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// "Does that count?" — asked only of the person the answer belongs to.
export function Judge({ me }: { me: PlayerId }) {
  const btn = 'min-h-[44px] px-4 rounded-xl font-bold uppercase tracking-widest active:translate-y-px'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-fg/50 mr-1">Count it?</span>
      <button className={btn + ' border-2 border-fg/30'} onClick={() => dispatch({ type: 'JUDGE', player: me, correct: false })}>
        No
      </button>
      <button className={btn + ' bg-accent text-bg'} onClick={() => dispatch({ type: 'JUDGE', player: me, correct: true })}>
        Yes
      </button>
    </div>
  )
}
