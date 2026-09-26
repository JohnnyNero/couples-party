import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { dispatch, useLive } from '../../net'
import { spectrumFor } from '../../views/wave'
import { playerName } from '../../views/list'
import { useLiveSender } from '../../views/useLiveSender'
import { WaveDial } from '../../ui/WaveDial'
import { Said } from '../../ui/kit'
import { btnAccent, eyebrow } from '../../ui/styles'
import { PlayWaiting } from './PlayWaiting'

// One needle, one shot — swinging it around is free, but locking in is final. Whoever
// gave the clue watches the needle move, with their mark in view.
export function PlayWaveGuess({ s, me }: { s: SessionState; me: PlayerId }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const guesser = other(round.psychic)
  const key = `wave:${s.seed}:${w.current}`
  const [value, setValue] = useState(50)
  const send = useLiveSender(key)
  const live = useLive(key)
  const spectrum = spectrumFor(s, round.spectrumId)

  if (me !== guesser) {
    const needle = typeof live === 'number' ? live : 50
    return (
      <div className="h-full flex flex-col px-5 pb-6">
        <div className="flex-1 flex flex-col justify-center gap-5">
          <div className={eyebrow + ' text-center'}>{playerName(s, guesser)} is placing your clue</div>
          <Said s={s} p={round.psychic}>{round.clue}</Said>
          <WaveDial low={spectrum.low} high={spectrum.high} target={round.target} guess={needle} marker={round.psychic} guesser={guesser} />
          <div className="text-sm text-fg/55 text-center">Poker face.</div>
        </div>
      </div>
    )
  }
  if (round.guess !== null) return <PlayWaiting label="Locked in" sub="Here comes the mark…" />

  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center gap-5">
        <Said s={s} p={round.psychic}>{round.clue}</Said>
        <WaveDial low={spectrum.low} high={spectrum.high} guess={value} marker={round.psychic} guesser={me} onChange={(v) => { setValue(v); send(v) }} />
        <div className="text-sm text-fg/70 leading-snug text-center">
          Drag the needle to where that sits. {playerName(s, round.psychic)} is watching — the closer you
          land to their hidden mark, the more they score for the clue.
        </div>
      </div>
      <button className={btnAccent} onClick={() => dispatch({ type: 'SUBMIT_GUESS', player: me, value })}>
        Lock it in
      </button>
    </div>
  )
}
