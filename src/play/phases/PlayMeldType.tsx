import { useEffect, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { normalize } from '../../engine/match'
import { dispatch } from '../../net/playroom'
import { PlayWaiting } from './PlayWaiting'

export function PlayMeldType({ s, me }: { s: SessionState; me: PlayerId }) {
  const meld = s.meld!
  const round = meld.rounds[meld.rounds.length - 1]
  const submitted = round.words[me] !== null
  const [word, setWord] = useState('')
  const [err, setErr] = useState('')
  // Clear the field whenever a new round starts.
  useEffect(() => { setWord(''); setErr('') }, [round.index])

  if (submitted) return <PlayWaiting label="SUBMITTED — WAITING" />

  const shown: [string, string] =
    round.index === 1 ? meld.seedPair
      : [meld.rounds[round.index - 2].words.A ?? '—', meld.rounds[round.index - 2].words.B ?? '—']

  const submit = () => {
    const w = word.trim()
    if (w.length === 0) return
    const already = s.meldWords.some((x) => normalize(x) === normalize(w))
    if (already) { setErr('already said'); return }
    dispatch({ type: 'SUBMIT_WORD', player: me, word: w })
  }

  return (
    <div className="p-6 font-board">
      <div className="text-xl text-fg/60 mb-2">MEET IN THE MIDDLE</div>
      <div className="text-3xl uppercase mb-6">{shown[0]} + {shown[1]}</div>
      <input
        className="w-full min-h-[48px] text-2xl bg-fg text-bg px-3"
        value={word} onChange={(e) => { setWord(e.target.value); setErr('') }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        autoFocus
      />
      {err && <div className="text-accent text-xl mt-2">{err}</div>}
      <button className="mt-6 w-full min-h-[48px] bg-accent text-bg text-2xl" onClick={submit}>SUBMIT</button>
    </div>
  )
}
