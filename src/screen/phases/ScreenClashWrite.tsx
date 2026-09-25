import type { SessionState } from '../../engine/state'
import { LetterTile, WhoIsIn } from '../../ui/kit'
import { card } from '../../ui/styles'

export function ScreenClashWrite({ s }: { s: SessionState }) {
  const g = s.clash!
  const round = g.rounds[g.current]
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center gap-5">
      <LetterTile letter={round.letter} size="lg" />
      <div className="font-bold text-fg/60">Everything starts with {round.letter}</div>
      <section className={card + ' w-full px-4 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 text-left'}>
        {round.categories.map((c, i) => (
          <div key={c} className="flex items-center gap-3 border-b border-fg/10 last:border-0 sm:[&:nth-last-child(2)]:border-0 py-2 text-base sm:text-2xl font-bold">
            <span className="w-5 shrink-0 font-display text-fg/35 tabular-nums">{i + 1}</span>
            <span className="truncate">{c}</span>
          </div>
        ))}
      </section>
      <WhoIsIn s={s} done={{ A: round.answers.A !== null, B: round.answers.B !== null }} big waiting={() => 'Writing…'} />
    </div>
  )
}
