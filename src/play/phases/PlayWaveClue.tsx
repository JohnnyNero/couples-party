import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { WAVE } from '../../engine/phases'
import { dispatch } from '../../net'
import { spectrumFor } from '../../views/wave'
import { WaveBar } from '../../views/WaveBar'
import { PlayWaiting } from './PlayWaiting'

// The psychic is the only one who ever sees the target — one clue, then it's out of
// their hands.
export function PlayWaveClue({ s, me }: { s: SessionState; me: PlayerId }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const [clue, setClue] = useState('')

  if (me !== round.psychic) return <PlayWaiting label="They're thinking of a clue" />
  if (round.clue !== null) return <PlayWaiting label="Clue given — waiting" />

  const spectrum = spectrumFor(s, round.spectrumId)
  const submit = () => {
    const t = clue.trim()
    if (t.length === 0) return
    dispatch({ type: 'SUBMIT_CLUE', player: me, text: t })
  }

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">Only you see the target</div>
      <WaveBar low={spectrum.low} high={spectrum.high} target={round.target} showTarget />
      <input
        className="w-full min-h-[56px] text-xl uppercase bg-fg text-bg px-4 outline-none border-b-4 border-accent placeholder:text-bg/30 placeholder:normal-case"
        value={clue}
        onChange={(e) => setClue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        maxLength={WAVE.clueMaxLen}
        placeholder="one word or phrase"
        autoFocus
        autoComplete="off"
      />
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={submit}
      >
        Give the clue
      </button>
    </div>
  )
}
