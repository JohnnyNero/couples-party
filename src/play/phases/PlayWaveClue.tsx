import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { WAVE } from '../../engine/phases'
import { dispatch } from '../../net'
import { spectrumFor } from '../../views/wave'
import { playerName } from '../../views/list'
import { WaveDial } from '../../ui/WaveDial'
import { btnAccent, eyebrow, field } from '../../ui/styles'
import { PlayWaiting } from './PlayWaiting'

// The clue-giver is the only one who ever sees the mark. The job needs saying out
// loud on the screen: without it the dial reads as abstract and nobody knows what the
// word they're being asked for is supposed to be.
export function PlayWaveClue({ s, me }: { s: SessionState; me: PlayerId }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const [clue, setClue] = useState('')

  if (me !== round.psychic) return <PlayWaiting label={`${playerName(s, round.psychic)} is thinking of something`} sub="You’ll place it on the scale next." />
  if (round.clue !== null) return <PlayWaiting label="Clue sent" sub={`${playerName(s, other(me))} is placing it.`} />

  const spectrum = spectrumFor(s, round.spectrumId)
  const submit = () => {
    const t = clue.trim()
    if (t.length === 0) return
    dispatch({ type: 'SUBMIT_CLUE', player: me, text: t })
  }

  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div className={eyebrow + ' text-center'}>Only you can see the mark</div>
        <WaveDial low={spectrum.low} high={spectrum.high} target={round.target} marker={me} guesser={other(me)} />
        <div className="text-sm text-fg/70 leading-snug text-center">
          Name one thing that sits <b className="text-accent-ink">right on the mark</b>. All they get is the
          thing — then they swing the needle to where they reckon it lands.
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <input
          className={field}
          value={clue}
          onChange={(e) => setClue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          maxLength={WAVE.clueMaxLen}
          placeholder="e.g. a hot bath"
          autoFocus
          autoComplete="off"
        />
        <button className={btnAccent} onClick={submit} disabled={clue.trim().length === 0}>
          Send it
        </button>
      </div>
    </div>
  )
}
