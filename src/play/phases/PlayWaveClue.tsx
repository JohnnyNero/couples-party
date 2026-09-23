import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { WAVE } from '../../engine/phases'
import { dispatch } from '../../net'
import { spectrumFor } from '../../views/wave'
import { WaveBar } from '../../views/WaveBar'
import { PlayWaiting } from './PlayWaiting'

// The clue-giver is the only one who ever sees the mark. The job needs saying out
// loud on the screen: without it the bar reads as an abstract dial and nobody knows
// what the word they're being asked for is supposed to be.
export function PlayWaveClue({ s, me }: { s: SessionState; me: PlayerId }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const [clue, setClue] = useState('')

  if (me !== round.psychic) return <PlayWaiting label="They're thinking of something" />
  if (round.clue !== null) return <PlayWaiting label="Clue given — waiting" />

  const spectrum = spectrumFor(s, round.spectrumId)
  const submit = () => {
    const t = clue.trim()
    if (t.length === 0) return
    dispatch({ type: 'SUBMIT_CLUE', player: me, text: t })
  }

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">Only you can see the mark</div>
      <WaveBar low={spectrum.low} high={spectrum.high} target={round.target} showTarget />
      <div className="text-sm text-fg/70 leading-snug">
        Name one thing that sits <span className="font-bold text-accent">right on the mark</span>.
        All they get is the thing — then they slide to where they reckon it lands.
      </div>
      <input
        className="w-full min-h-[56px] text-xl uppercase bg-ink text-paper px-4 outline-none border-b-4 border-accent placeholder:text-paper/30 placeholder:normal-case"
        value={clue}
        onChange={(e) => setClue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        maxLength={WAVE.clueMaxLen}
        placeholder="e.g. a hot bath"
        autoFocus
        autoComplete="off"
      />
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={submit}
      >
        Send it
      </button>
    </div>
  )
}
