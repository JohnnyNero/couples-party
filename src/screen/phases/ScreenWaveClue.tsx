import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { spectrumFor } from '../../views/wave'
import { playerName } from '../../views/list'
import { WaveDial } from '../../ui/WaveDial'
import { Doing } from '../../ui/kit'

// The board never shows the mark or the clue while it's still being written — only
// that they're on it.
export function ScreenWaveClue({ s }: { s: SessionState }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const spectrum = spectrumFor(s, round.spectrumId)
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center gap-6">
      <div className="font-display text-2xl sm:text-4xl font-extrabold leading-tight">
        {playerName(s, round.psychic)} is naming something on this scale
      </div>
      <WaveDial low={spectrum.low} high={spectrum.high} marker={round.psychic} guesser={other(round.psychic)} />
      <Doing s={s} p={round.psychic} finished={round.clue !== null} busy="Thinking of a clue…" done="Got one" />
    </div>
  )
}
