import { useEffect, useRef, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { MELD } from '../../engine/phases'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { MeldTrail } from '../../screen/phases/ScreenMeld'
import { btnAccent, eyebrow, field } from '../../ui/styles'
import { PlayWaiting } from './PlayWaiting'

// One word, at the same time as them. After a miss, both words so far sit above the box:
// the aim is the word between them.
export function PlayMeldWrite({ s, me }: { s: SessionState; me: PlayerId }) {
  const round = s.meld!.rounds[s.meld!.current]
  const t = round.tries.length - 1
  const [word, setWord] = useState('')
  const latest = useRef(word)
  latest.current = word
  const sent = round.tries[t][me] !== null
  // Typed but not sent when the clock runs out: send it just before.
  useEffect(() => {
    if (sent || s.phaseEndsAt == null) return
    const id = setTimeout(() => {
      if (latest.current.trim()) dispatch({ type: 'SUBMIT_MELD', player: me, word: latest.current })
    }, Math.max(0, s.phaseEndsAt - Date.now() - 600))
    return () => clearTimeout(id)
  }, [sent, s.phaseEndsAt, me])

  const them = other(me)
  if (sent) return <PlayWaiting label="Sent" sub={round.tries[t][them] !== null ? 'Here it comes…' : `Waiting for ${playerName(s, them)}`} />
  const send = () => { if (word.trim()) dispatch({ type: 'SUBMIT_MELD', player: me, word }) }

  return (
    <div className="h-full flex flex-col px-5 pb-6">
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div className={eyebrow + ' text-accent-ink'}>{t === 0 ? 'Say the same thing' : `Try ${t + 1} of ${MELD.tries} · meet in the middle`}</div>
        <div className="font-display text-[1.9rem] font-extrabold leading-[1.1] tracking-tight break-words">{round.prompt}</div>
        <MeldTrail s={s} round={round} upTo={t} />
        {t > 0 && <div className="text-sm text-fg/60">What links those two? Say the word you think {playerName(s, them)} will.</div>}
      </div>
      <div className="flex flex-col gap-2.5">
        <input
          className={field + ' text-2xl'}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          maxLength={MELD.maxLen}
          placeholder="one word or two"
          autoFocus
          autoComplete="off"
          enterKeyHint="send"
        />
        <button className={btnAccent} onClick={send} disabled={!word.trim()}>Send</button>
      </div>
    </div>
  )
}
