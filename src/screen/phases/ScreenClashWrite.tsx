import type { SessionState } from '../../engine/state'
import { Dot } from '../../views/Dot'
import { playerName } from '../../views/list'

export function ScreenClashWrite({ s }: { s: SessionState }) {
  const g = s.clash!
  const round = g.rounds[g.current]
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-2">
        Category Clash · round {round.index} of {g.rounds.length}
      </div>
      <div className="font-display text-8xl sm:text-9xl font-bold text-accent leading-none">{round.letter}</div>
      <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-left">
        {round.categories.map((c) => (
          <div key={c} className="border-b border-fg/10 py-1 text-base sm:text-2xl uppercase tracking-tight truncate">{c}</div>
        ))}
      </div>
      <div className="mt-5 sm:mt-8 flex justify-center gap-8">
        {(['A', 'B'] as const).map((p) => (
          <span key={p} className="flex items-center gap-2 text-sm sm:text-xl uppercase tracking-wide">
            <Dot on={round.answers[p] !== null} /> {playerName(s, p)}
          </span>
        ))}
      </div>
    </div>
  )
}
