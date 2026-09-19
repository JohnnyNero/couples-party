import type { SessionState } from '../../engine/state'

export function ScreenMeldReveal({ s }: { s: SessionState }) {
  const meld = s.meld!
  const round = meld.rounds[meld.rounds.length - 1]

  if (round.converged) {
    return (
      <div className="w-full text-center">
        <div className="text-xs sm:text-sm uppercase tracking-[0.3em] text-accent mb-3 sm:mb-4">Meld</div>
        <div className="text-5xl sm:text-8xl font-bold uppercase tracking-tight text-accent break-words">
          {round.words.A}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full text-center">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-12">
        <div className="text-4xl sm:text-7xl font-bold uppercase tracking-tight">{round.words.A ?? '—'}</div>
        <div className="text-4xl sm:text-7xl font-bold uppercase tracking-tight">{round.words.B ?? '—'}</div>
      </div>
      <MeldRail meld={meld} />
    </div>
  )
}

function MeldRail({ meld }: { meld: NonNullable<SessionState['meld']> }) {
  const prior = meld.rounds.slice(0, -1)
  if (prior.length === 0) return null
  return (
    <div className="mt-8 sm:mt-12 space-y-1 text-sm sm:text-2xl text-fg/40 uppercase">
      {prior.map((r) => (
        <div key={r.index}>
          {r.words.A ?? '—'} <span className="text-fg/20">/</span> {r.words.B ?? '—'}
        </div>
      ))}
    </div>
  )
}
