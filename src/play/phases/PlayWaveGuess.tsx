import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { dispatch } from '../../net'
import { spectrumFor } from '../../views/wave'
import { playerName } from '../../views/list'
import { WaveDial } from '../../ui/WaveDial'
import { Said } from '../../ui/kit'
import { btnAccent } from '../../ui/styles'
import { PlayWaiting } from './PlayWaiting'

// One needle, one shot — swinging it around is free, but locking in is final.
export function PlayWaveGuess({ s, me }: { s: SessionState; me: PlayerId }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const guesser = other(round.psychic)
  const [value, setValue] = useState(50)

  if (me !== guesser) return <PlayWaiting label={`${playerName(s, guesser)} is placing it`} sub="Poker face." />
  if (round.guess !== null) return <PlayWaiting label="Locked in" sub="Here comes the mark…" />

  const spectrum = spectrumFor(s, round.spectrumId)

  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center gap-5">
        <Said s={s} p={round.psychic}>{round.clue}</Said>
        <WaveDial low={spectrum.low} high={spectrum.high} guess={value} marker={round.psychic} guesser={me} onChange={setValue} />
        <div className="text-sm text-fg/70 leading-snug text-center">
          Drag the needle to where that sits. There’s a hidden mark — the closer you land, the
          more {playerName(s, round.psychic)} scores for the clue.
        </div>
      </div>
      <button className={btnAccent} onClick={() => dispatch({ type: 'SUBMIT_GUESS', player: me, value })}>
        Lock it in
      </button>
    </div>
  )
}
