import type { SessionState } from '../../engine/state'
export function ScreenMeldType({ s }: { s: SessionState }) {
  const meld = s.meld!
  const round = meld.rounds[meld.rounds.length - 1]
  const shown: [string, string] =
    round.index === 1 ? meld.seedPair
      : [meld.rounds[round.index - 2].words.A ?? '—', meld.rounds[round.index - 2].words.B ?? '—']
  const filled = (w: string | null) => (w !== null ? 'text-accent' : 'text-fg/30')
  return (
    <div className="text-center">
      <div className="flex gap-16 justify-center items-center">
        <div className="text-6xl uppercase">{shown[0]}</div>
        <div className="text-4xl text-fg/40">+</div>
        <div className="text-6xl uppercase">{shown[1]}</div>
      </div>
      <div className="mt-12 text-5xl">
        <span className={filled(round.words.A)}>●</span>{' '}
        <span className={filled(round.words.B)}>●</span>
      </div>
    </div>
  )
}
