import { useState } from 'react'
import type { SessionState } from '../../engine/state'
import { STAKE } from '../../engine/phases'
import { dispatch } from '../../net'
import { PlayWaiting } from './PlayWaiting'

// Either phone can type the single agreed forfeit; the first non-empty submission wins
// (the reducer guards against a second). The pair agree out loud first.
export function PlayStakeSet({ s }: { s: SessionState }) {
  const [text, setText] = useState('')
  if (s.stake !== null) return <PlayWaiting label="Stake locked in" />

  const submit = () => {
    const t = text.trim()
    if (t.length === 0) return
    dispatch({ type: 'SET_STAKE', text: t })
  }

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-1">Agree out loud, then</div>
        <div className="text-xl font-bold uppercase tracking-tight">Type the one forfeit</div>
        <div className="mt-1 text-sm uppercase tracking-wide text-fg/50">The loser does this — for the whole night</div>
      </div>
      <input
        className="w-full min-h-[56px] text-lg bg-fg text-bg px-4 outline-none border-b-4 border-accent placeholder:text-bg/30"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        maxLength={STAKE.maxLen}
        placeholder="e.g. makes coffee for a week"
        autoComplete="off"
        autoFocus
      />
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={submit}
      >
        Set the forfeit
      </button>
    </div>
  )
}
