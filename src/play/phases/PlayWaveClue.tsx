import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { WAVE } from '../../engine/phases'
import { pairOf } from '../../engine/reducer'
import { dispatch } from '../../net'
import { spectrumFor } from '../../views/wave'
import { playerName } from '../../views/list'
import { WaveDial } from '../../ui/WaveDial'
import { btnAccent, eyebrow, field } from '../../ui/styles'
import { PlayWaiting } from './PlayWaiting'

// You each have your own scale and mark, and write your clues at the same time. Only
// you ever see your mark. The job needs saying out loud on the screen: without it the
// dial reads as abstract and nobody knows what the word they're asked for is for.
export function PlayWaveClue({ s, me }: { s: SessionState; me: PlayerId }) {
  const w = s.wave!
  const round = pairOf(w).find((r) => r.psychic === me)
  const [clue, setClue] = useState('')
  const them = other(me)

  if (!round) return <PlayWaiting label={`${playerName(s, them)} is thinking of something`} sub="You’ll place it on the scale next." />
  if (round.clue !== null) {
    const theirs = pairOf(w).find((r) => r.psychic === them)
    return <PlayWaiting label="Clue sent" sub={theirs && theirs.clue === null ? `Waiting for ${playerName(s, them)}’s clue.` : 'Here we go…'} />
  }

  const spectrum = spectrumFor(s, round.spectrumId)
  const submit = () => {
    const t = clue.trim()
    if (t.length === 0) return
    dispatch({ type: 'SUBMIT_CLUE', player: me, text: t })
  }

  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div className={eyebrow + ' text-center'}>Only you can see your mark</div>
        <WaveDial low={spectrum.low} high={spectrum.high} target={round.target} marker={me} guesser={them} />
        <div className="text-sm text-fg/70 leading-snug text-center">
          Name one thing that sits <b className="text-accent-ink">right on the mark</b>. {playerName(s, them)} is
          writing one for you at the same time — then you take turns placing each other’s.
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
