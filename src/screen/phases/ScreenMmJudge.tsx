import { aboutReader } from '../../views/voice'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { mrmrsRoundPoints } from '../../engine/standing'
import { dispatch, useMyPlayerId } from '../../net'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { card } from '../../ui/styles'

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
      <div className="text-center font-display text-xl sm:text-3xl font-extrabold leading-tight break-words">
        {aboutReader(s, round.question, me)}
      </div>
      {ORDER.map((subject, i) => {
        const predictor = other(subject)
        const verdict = round.verdict[predictor]
        const points = mrmrsRoundPoints(round, predictor)
        return (
          <section
            key={subject}
            style={{ animationDelay: `${i * 250}ms` }}
            className={card + ' p-4 sm:p-5 animate-fade-up'}
          >
            <div className="flex items-center gap-3">
              <Avatar p={subject} name={playerName(s, subject)} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-extrabold text-fg/55">{playerName(s, subject)} said</div>
                <div className={'font-display text-2xl sm:text-3xl font-extrabold leading-tight break-words ' + inkOf(subject)}>
                  {round.answer[subject] ?? '—'}
                </div>
              </div>
            </div>
            <div className="mt-2 ml-12 flex items-baseline gap-2 min-w-0">
              <span className="shrink-0 text-xs sm:text-sm font-extrabold text-fg/55">{playerName(s, predictor)} guessed</span>
              <span className={'min-w-0 break-words font-display text-lg sm:text-2xl font-bold leading-tight ' + inkOf(predictor)}>
                {round.predict[predictor] ?? '—'}
              </span>
            </div>
            <div className="mt-3 flex justify-end">
              {verdict === null ? (
                me === subject ? (
                  <Judge me={me} />
                ) : (
                  <span className="text-sm font-bold text-fg/50">{playerName(s, subject)} is deciding…</span>
                )
              ) : verdict ? (
                <span className="rounded-full bg-sage-soft text-sage-ink px-3 py-1 text-sm sm:text-lg font-extrabold animate-reveal-pop">
                  Got it · {playerName(s, predictor)} +{points}
                </span>
              ) : (
                <span className="rounded-full bg-fg/10 text-fg/60 px-3 py-1 text-sm sm:text-lg font-extrabold animate-reveal-pop">
                  Not quite
                </span>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// "Does that count?" — asked only of the person the answer belongs to.
export function Judge({ me, big = false }: { me: PlayerId; big?: boolean }) {
  const btn = 'rounded-2xl font-display font-extrabold active:translate-y-px ' + (big ? 'flex-1 min-h-[60px] text-xl' : 'min-h-[44px] px-5 text-lg')
  return (
    <div className={'flex flex-col gap-2 ' + (big ? 'w-full' : 'items-end')}>
      <span className="text-sm font-extrabold text-fg/60">{big ? 'Does that count?' : 'Count it?'}</span>
      <div className={'flex gap-2 ' + (big ? 'w-full' : '')}>
        <button className={btn + ' border-2 border-fg bg-card'} onClick={() => dispatch({ type: 'JUDGE', player: me, correct: false })}>
          Not quite
        </button>
        <button className={btn + ' bg-fg text-bg'} onClick={() => dispatch({ type: 'JUDGE', player: me, correct: true })}>
          Yes
        </button>
      </div>
    </div>
  )
}
