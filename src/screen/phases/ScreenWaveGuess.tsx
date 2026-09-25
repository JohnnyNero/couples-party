import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { spectrumFor } from '../../views/wave'
import { playerName } from '../../views/list'
import { WaveDial } from '../../ui/WaveDial'
import { Doing, Said } from '../../ui/kit'

// The clue is public now — everyone in the room heard it. The target stays hidden
// until the reveal.
export function ScreenWaveGuess({ s }: { s: SessionState }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const spectrum = spectrumFor(s, round.spectrumId)
  const guesser = other(round.psychic)
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center gap-6">
      <Said s={s} p={round.psychic} big>{round.clue}</Said>
      <WaveDial low={spectrum.low} high={spectrum.high} marker={round.psychic} guesser={guesser} />
      <Doing s={s} p={guesser} finished={round.guess !== null} busy={`${playerName(s, guesser)} is placing it…`} done="Locked in" />
    </div>
  )
}
