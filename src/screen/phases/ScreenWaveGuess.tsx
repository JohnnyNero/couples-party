import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { WAVE } from '../../engine/phases'
import { Dot } from '../../views/Dot'
import { spectrumFor } from '../../views/wave'
import { playerName } from '../../views/list'

// The clue is public now — everyone in the room heard it. The target stays hidden
// until the reveal.
export function ScreenWaveGuess({ s }: { s: SessionState }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const spectrum = spectrumFor(s, round.spectrumId)
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Round {round.index} of {WAVE.rounds} · {playerName(s, other(round.psychic))} is placing it on the scale
      </div>
      <div className="text-sm sm:text-lg uppercase tracking-wide text-fg/50 mb-2">
        {spectrum.low} <span className="text-fg/30">↔</span> {spectrum.high}
      </div>
      <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight break-words">
        "{round.clue}"
      </div>
      <div className="mt-8 sm:mt-14 flex items-center justify-center gap-4">
        <Dot on={round.guess !== null} />
      </div>
    </div>
  )
}
