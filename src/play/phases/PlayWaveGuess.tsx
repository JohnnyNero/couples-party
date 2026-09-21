import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { dispatch } from '../../net'
import { spectrumFor } from '../../views/wave'
import { PlayWaiting } from './PlayWaiting'

// One slider, one shot — dragging it around is free, but locking in is final.
export function PlayWaveGuess({ s, me }: { s: SessionState; me: PlayerId }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const guesser = other(round.psychic)
  const [value, setValue] = useState(50)

  if (me !== guesser) return <PlayWaiting label="They're guessing" />
  if (round.guess !== null) return <PlayWaiting label="Locked in — waiting" />

  const spectrum = spectrumFor(s, round.spectrumId)

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-5">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-2">Their clue</div>
        <div className="text-2xl font-bold uppercase tracking-tight break-words">"{round.clue}"</div>
      </div>
      <div>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full accent-accent h-8"
        />
        <div className="mt-1 flex justify-between gap-2 text-[0.6rem] uppercase tracking-wide text-fg/50">
          <span>{spectrum.low}</span>
          <span className="text-right">{spectrum.high}</span>
        </div>
      </div>
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={() => dispatch({ type: 'SUBMIT_GUESS', player: me, value })}
      >
        Lock in my guess
      </button>
    </div>
  )
}
