import type { SessionState } from '../../engine/state'
import { FORFEIT } from '../../engine/phases'

export function ScreenForfeitWrite({ s }: { s: SessionState }) {
  const count = (p: 'A' | 'B') => s.forfeits.filter((f) => f.authoredBy === p).length
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="text-2xl sm:text-4xl font-bold uppercase tracking-tight mb-3">Write your forfeits</div>
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-8 sm:mb-12">
        What the loser has to do · {FORFEIT.targetEach} each
      </div>
      <div className="flex justify-center gap-12 sm:gap-20">
        <Counter name={s.players.A.name || 'Player A'} n={count('A')} />
        <Counter name={s.players.B.name || 'Player B'} n={count('B')} />
      </div>
    </div>
  )
}
function Counter({ name, n }: { name: string; n: number }) {
  return (
    <div>
      <div className="text-6xl sm:text-8xl font-bold tabular-nums leading-none">{n}<span className="text-fg/25 text-3xl sm:text-5xl">/{FORFEIT.targetEach}</span></div>
      <div className="mt-3 text-sm sm:text-lg uppercase tracking-widest text-fg/60">{name}</div>
    </div>
  )
}
