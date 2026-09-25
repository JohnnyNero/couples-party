import { useEffect, useRef, useState } from 'react'
import { aboutReader } from '../../views/voice'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { MRMRS } from '../../engine/phases'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { btnAccent, field } from '../../ui/styles'
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

  const them = other(me)
  if (sent) return <PlayWaiting label="Both sent" sub={round.answer[them] !== null ? 'Revealing…' : `Waiting for ${playerName(s, them)}`} />

  const theirName = playerName(s, them)
  const ready = answer.trim().length > 0 && predict.trim().length > 0
  const send = () => {
    if (!ready) return
    dispatch({ type: 'SUBMIT_MRMRS', player: me, answer, predict })
  }

  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center gap-5">
        <div className="font-display text-[1.9rem] font-extrabold leading-[1.1] tracking-tight break-words">{aboutReader(s, round.question, me)}</div>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-sm font-extrabold">
            <Avatar p={me} name={playerName(s, me)} size="sm" /> Your answer
          </span>
          <input
            className={field}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={MRMRS.maxLen}
            placeholder="be honest"
            autoFocus
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={'flex items-center gap-2 text-sm font-extrabold ' + inkOf(them)}>
            <Avatar p={them} name={theirName} size="sm" /> What will {theirName} say?
          </span>
          <input
            className={field + ' focus:!border-pb'}
            value={predict}
            onChange={(e) => setPredict(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            maxLength={MRMRS.maxLen}
            placeholder={`${theirName}’s answer`}
            autoComplete="off"
          />
        </label>
      </div>
      <button className={btnAccent} onClick={send} disabled={!ready}>
        Send both
      </button>
    </div>
  )
}
