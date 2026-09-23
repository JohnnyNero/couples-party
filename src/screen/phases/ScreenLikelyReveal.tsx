import type { PlayerId, SessionState } from '../../engine/state'
import { likelyRoundPoints } from '../../engine/standing'
import { playerName } from '../../views/list'

const ORDER: PlayerId[] = ['A', 'B']

// Each of you, and the name you tapped — the second one lands a beat after the first,
// so there's a moment where you know your own answer and not theirs.
export function ScreenLikelyReveal({ s }: { s: SessionState }) {
  const g = s.likely!
  const round = g.rounds[g.current]
  const points = likelyRoundPoints(round)
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-2 sm:mb-4">
        Who's more likely to
      </div>
      <div className="text-xl sm:text-4xl font-bold uppercase tracking-tight break-words mb-6 sm:mb-10">
        {round.statement}?
      </div>
      <div className="flex justify-center gap-8 sm:gap-16">
        {ORDER.map((p, i) => {
          const pick = round.picks[p]
          return (
            <div key={p} className="min-w-0">
              <div className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40 mb-2">
                {playerName(s, p)} said
              </div>
              <div
                style={{ animationDelay: `${i * 450}ms` }}
                className="text-2xl sm:text-5xl font-bold uppercase tracking-tight animate-reveal-pop truncate"
              >
                {pick ? playerName(s, pick) : '—'}
              </div>
            </div>
          )
        })}
      </div>
      <div
        style={{ animationDelay: '900ms' }}
        className="mt-8 sm:mt-12 text-lg sm:text-3xl font-bold uppercase tracking-tight text-accent animate-reveal-pop"
      >
        {points > 0 ? `Same page · +${points} each` : 'Different pages'}
      </div>
    </div>
  )
}
