import type { SessionState } from '../../engine/state'

export function ScreenMeldResult({ s }: { s: SessionState }) {
  const meld = s.meld!
  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-4">
        The chain
      </div>
      <div className="space-y-1 mb-6 sm:mb-8">
        {meld.rounds.map((r) => (
          <div
            key={r.index}
            className={
              'flex items-baseline gap-3 text-base sm:text-2xl uppercase ' +
              (r.converged ? 'text-accent' : 'text-fg/80')
            }
          >
            <span className="text-fg/30 tabular-nums text-xs sm:text-sm w-5">{r.index}</span>
            <span>{r.words.A ?? '—'}</span>
            <span className="text-fg/20">/</span>
            <span>{r.words.B ?? '—'}</span>
          </div>
        ))}
      </div>
      <div className="border-t-2 border-fg/80 pt-4 text-2xl sm:text-5xl font-bold uppercase tracking-tight">
        {meld.converged ? `Converged in ${meld.roundsTaken}` : 'No convergence'}
      </div>
    </div>
  )
}
