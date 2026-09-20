import { useEffect, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { dispatch } from '../../net'
import { shownPair, isAlreadySaid } from '../../views/meld'
import { PlayWaiting } from './PlayWaiting'

export function PlayMeldType({ s, me }: { s: SessionState; me: PlayerId }) {
  const meld = s.meld!
  const round = meld.rounds[meld.rounds.length - 1]
  const submitted = round.words[me] !== null
  const [word, setWord] = useState('')
  const [err, setErr] = useState('')
  // Clear the field whenever a new round starts.
  useEffect(() => { setWord(''); setErr('') }, [round.index])

  if (submitted) return <PlayWaiting label="Locked in — waiting" />

  const [a, b] = shownPair(meld, round)

  const submit = () => {
    const w = word.trim()
    if (w.length === 0) return
    if (isAlreadySaid(meld, round, w)) {
      setErr('already said')
      return
    }
    dispatch({ type: 'SUBMIT_WORD', player: me, word: w })
  }

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-2">Meet in the middle</div>
        <div className="text-2xl sm:text-3xl font-bold uppercase tracking-tight">
          {a} <span className="text-fg/30">+</span> {b}
        </div>
      </div>
      <input
        className="w-full min-h-[56px] text-2xl uppercase bg-fg text-bg px-4 outline-none border-b-4 border-accent placeholder:text-bg/30 placeholder:normal-case"
        value={word}
        onChange={(e) => { setWord(e.target.value); setErr('') }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        placeholder="your word"
        autoFocus
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
      />
      <div className="min-h-[1.25rem] text-accent uppercase tracking-widest text-sm">{err}</div>
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={submit}
      >
        Submit
      </button>
    </div>
  )
}
