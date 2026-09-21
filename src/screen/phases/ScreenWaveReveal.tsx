import type { SessionState } from '../../engine/state'
import { waveAward } from '../../engine/standing'
import { spectrumFor } from '../../views/wave'
import { WaveBar } from '../../views/WaveBar'
import { playerName } from '../../views/list'

export function ScreenWaveReveal({ s }: { s: SessionState }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const spectrum = spectrumFor(s, round.spectrumId)
  const award = waveAward(round)
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        "{round.clue}"
      </div>
      <WaveBar
        low={spectrum.low}
        high={spectrum.high}
        target={round.target}
        guess={round.guess}
        showTarget
      />
      <div className="mt-6 sm:mt-10 flex items-baseline justify-between gap-4">
        <span className="text-lg sm:text-3xl font-bold uppercase tracking-tight">
          Off by <span className="tabular-nums">{round.distance}</span>
        </span>
        <span className="text-lg sm:text-3xl font-bold uppercase tracking-tight text-accent text-right">
          {award ? `${playerName(s, award.player)} +${award.points}` : 'Nothing moves'}
        </span>
      </div>
    </div>
  )
}
