import type { PlayerId, SessionState } from '../../engine/state'
import { likelyRoundPoints, shown as scaled } from '../../engine/standing'
import { playerName } from '../../views/list'
import { Burst, at, verdictFx } from '../../ui/fx'

const ORDER: PlayerId[] = ['A', 'B']

// Each of you, and the name you tapped — the second card turns over a beat after the
// first, so there's a moment where you know your own answer and not theirs. Then the
// verdict: hearts if you're on the same page.
export function ScreenLikelyReveal({ s }: { s: SessionState }) {
  const g = s.likely!
  const round = g.rounds[g.current]
  const points = scaled(s, 'likely', likelyRoundPoints(round))
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="text-[0.7rem] sm:text-sm uppercase tracking-[0.22em] font-extrabold text-fg/50 mb-2 sm:mb-4">
        Who's more likely to
      </div>
      <div className="text-xl sm:text-4xl font-display font-extrabold leading-tight break-words mb-6 sm:mb-10">
        {round.statement}?
      </div>
      <div className="flex justify-center gap-8 sm:gap-16">
        {ORDER.map((p, i) => {
          const pick = round.picks[p]
          return (
            <div key={p} className="min-w-0">
              <div className="text-[0.7rem] sm:text-xs uppercase tracking-[0.22em] font-extrabold text-fg/50 mb-2">
                {playerName(s, p)} said
              </div>
              <div
                style={at(250 + i * 550)}
                className="text-2xl sm:text-5xl font-display font-extrabold leading-tight animate-flip-in truncate"
              >
                {pick ? playerName(s, pick) : '—'}
              </div>
            </div>
          )
        })}
      </div>
      <div className="relative mt-8 sm:mt-12">
        <div
          style={at(1350)}
          className={'text-lg sm:text-3xl font-display font-extrabold leading-tight ' + (points > 0 ? 'text-accent-ink ' : 'text-fg/60 ') + verdictFx(points > 0)}
        >
          {points > 0 ? `Same page · +${points} each` : 'Different pages'}
        </div>
        {points > 0 && <Burst hearts delay={1450} />}
      </div>
    </div>
  )
}
