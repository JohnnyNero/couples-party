import type { SessionState } from '../../engine/state'
export function ScreenMeldReveal({ s }: { s: SessionState }) {
  const meld = s.meld!
  const round = meld.rounds[meld.rounds.length - 1]
  if (round.converged) {
    return <div className="text-8xl uppercase text-accent">{round.words.A}</div>
  }
  return (
    <div className="text-center">
      <div className="flex gap-16 justify-center">
        <div className="text-7xl uppercase">{round.words.A ?? '—'}</div>
        <div className="text-7xl uppercase">{round.words.B ?? '—'}</div>
      </div>
      <MeldRail meld={meld} />
    </div>
  )
}
function MeldRail({ meld }: { meld: SessionState['meld'] }) {
  if (!meld) return null
  return (
    <div className="mt-10 text-2xl text-fg/50 space-y-1">
      {meld.rounds.slice(0, -1).map((r) => (
        <div key={r.index}>{(r.words.A ?? '—')} / {(r.words.B ?? '—')}</div>
      ))}
    </div>
  )
}
