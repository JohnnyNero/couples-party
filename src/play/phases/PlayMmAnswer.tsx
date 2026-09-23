import { useEffect, useRef, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { MRMRS } from '../../engine/phases'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { PlayWaiting } from './PlayWaiting'

// Two answers on one screen: yours, then your guess at theirs. Both go at once, so you
// can't see what they said about themselves before guessing — they can't see yours.
export function PlayMmAnswer({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.mrmrs!
  const round = g.rounds[g.current]
  const [answer, setAnswer] = useState('')
  const [predict, setPredict] = useState('')

  // Typed but not sent is lost when the clock runs out — so send it just before. Your
  // own answer is the one that matters; a missing guess at theirs just scores nothing.
  const latest = useRef({ answer, predict })
  latest.current = { answer, predict }
  const sent = round.answer[me] !== null
  useEffect(() => {
    if (sent || s.phaseEndsAt == null) return
    const id = setTimeout(() => {
      const { answer: a, predict: p } = latest.current
      if (a.trim()) dispatch({ type: 'SUBMIT_MRMRS', player: me, answer: a, predict: p })
    }, Math.max(0, s.phaseEndsAt - Date.now() - 600))
    return () => clearTimeout(id)
  }, [sent, s.phaseEndsAt, me])

  if (sent) return <PlayWaiting label="Sent — waiting on them" />

  const them = playerName(s, other(me))
  const ready = answer.trim().length > 0 && predict.trim().length > 0
  const send = () => {
    if (!ready) return
    dispatch({ type: 'SUBMIT_MRMRS', player: me, answer, predict })
  }
  const field =
    'w-full min-h-[52px] text-lg uppercase bg-ink text-paper px-4 outline-none border-b-4 rounded-t-xl ' +
    'placeholder:text-paper/30 placeholder:normal-case'

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4">
      <div className="text-2xl font-bold uppercase tracking-tight break-words">{round.question}</div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/50">Your answer</span>
        <input
          className={field + ' border-fg/40'}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={MRMRS.maxLen}
          placeholder="be honest"
          autoFocus
          autoComplete="off"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-accent font-bold">
          What will {them} say?
        </span>
        <input
          className={field + ' border-accent'}
          value={predict}
          onChange={(e) => setPredict(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          maxLength={MRMRS.maxLen}
          placeholder={`${them}'s answer`}
          autoComplete="off"
        />
      </label>
      <button
        className="w-full min-h-[56px] rounded-xl bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px disabled:opacity-40"
        onClick={send}
        disabled={!ready}
      >
        Send both
      </button>
    </div>
  )
}
