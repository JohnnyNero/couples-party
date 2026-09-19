import type { SessionState } from '../../engine/state'
export function ScreenMeldResult({ s }: { s: SessionState }) {
  const meld = s.meld!
  const outcome = meld.converged
    ? `CONVERGED IN ${meld.roundsTaken}`
    : 'NO CONVERGENCE'
  return (
    <div className="text-center">
      <div className="text-2xl space-y-1 mb-8">
        {meld.rounds.map((r) => (
          <div key={r.index} className={r.converged ? 'text-accent' : ''}>
            {(r.words.A ?? '—')} / {(r.words.B ?? '—')}
          </div>
        ))}
      </div>
      <div className="text-5xl">{outcome}</div>
    </div>
  )
}
