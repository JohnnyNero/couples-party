import type { SessionState } from '../../engine/state'
import { Dot } from '../../views/Dot'
import { spectrumFor } from '../../views/wave'
import { playerName } from '../../views/list'

// The board never shows the mark or the clue while it's still being written — only
// that they're on it.
export function ScreenWaveClue({ s }: { s: SessionState }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const spectrum = spectrumFor(s, round.spectrumId)
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Round {round.index} of {w.rounds.length} · {playerName(s, round.psychic)} is naming something on this scale
      </div>
      <div className="text-2xl sm:text-5xl font-bold uppercase tracking-tight break-words">
        {spectrum.low} <span className="text-fg/30">↔</span> {spectrum.high}
      </div>
      <div className="mt-8 sm:mt-14 flex items-center justify-center gap-4">
        <Dot on={round.clue !== null} />
      </div>
    </div>
  )
}
