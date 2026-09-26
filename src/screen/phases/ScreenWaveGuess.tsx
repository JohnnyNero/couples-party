import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { useLive } from '../../net'
import { spectrumFor } from '../../views/wave'
import { playerName } from '../../views/list'
import { WaveDial } from '../../ui/WaveDial'
import { Doing, Said } from '../../ui/kit'

// The clue is public now — everyone in the room heard it — and the needle moves as the
// guesser drags it. The mark stays hidden until the reveal.
export function ScreenWaveGuess({ s }: { s: SessionState }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const spectrum = spectrumFor(s, round.spectrumId)
  const guesser = other(round.psychic)
  const live = useLive(`wave:${s.seed}:${w.current}`)
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center gap-6">
      <Said s={s} p={round.psychic} big>{round.clue}</Said>
      <WaveDial low={spectrum.low} high={spectrum.high} guess={typeof live === 'number' ? live : null} marker={round.psychic} guesser={guesser} />
      <Doing s={s} p={guesser} finished={round.guess !== null} busy={`${playerName(s, guesser)} is placing it…`} done="Locked in" />
    </div>
  )
}
