import { useEffect, useRef, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { BLUFF } from '../../engine/phases'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { bluffPrompt } from '../../views/bluff'
import { btnAccent, field } from '../../ui/styles'
import { PlayWaiting } from './PlayWaiting'

// Your truth and two lies, all at once — sending them is you saying you're ready. Your
// partner is writing theirs at the same time, about themselves.
export function PlayBluffWrite({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.bluff!
  const round = g.rounds[g.current]
  const [truth, setTruth] = useState('')
  const [lie1, setLie1] = useState('')
  const [lie2, setLie2] = useState('')
  const ready = [truth, lie1, lie2].every((t) => t.trim().length > 0)

  // All three typed but not sent when the clock runs out? Send them just before.
  const latest = useRef({ truth, lie1, lie2 })
  latest.current = { truth, lie1, lie2 }
  const sent = round.entry[me] !== null
  useEffect(() => {
    if (sent || s.phaseEndsAt == null) return
    const id = setTimeout(() => {
      const { truth: t, lie1: a, lie2: b } = latest.current
      if (t.trim() && a.trim() && b.trim()) dispatch({ type: 'SUBMIT_BLUFF', player: me, truth: t, lies: [a, b] })
    }, Math.max(0, s.phaseEndsAt - Date.now() - 600))
    return () => clearTimeout(id)
  }, [sent, s.phaseEndsAt, me])

  const them = other(me)
  if (sent) {
    return <PlayWaiting label="You’re ready" sub={round.entry[them] ? 'Here we go…' : `Waiting for ${playerName(s, them)} to finish theirs`} />
  }

  const send = () => { if (ready) dispatch({ type: 'SUBMIT_BLUFF', player: me, truth, lies: [lie1, lie2] }) }
  const box = (label: string, hint: string, value: string, set: (v: string) => void, tone: string, last = false) => (
    <label className="flex flex-col gap-1.5">
      <span className={'text-sm font-extrabold ' + tone}>{label}</span>
      <input
        className={field}
        value={value}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => { if (last && e.key === 'Enter') send() }}
        maxLength={BLUFF.maxLen}
        placeholder={hint}
        autoComplete="off"
      />
    </label>
  )

  return (
    <div className="h-full flex flex-col px-5 pb-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center gap-4 py-4">
        <div className="font-display text-[1.75rem] font-extrabold leading-[1.1] tracking-tight break-words">{bluffPrompt(s, round, me, me)}</div>
        <div className="text-sm text-fg/60 -mt-2">{playerName(s, them)} will see all three, shuffled, and try to find the true one.</div>
        {box('The truth', 'what really happened', truth, setTruth, 'text-sage-ink')}
        {box('A lie', 'make it believable', lie1, setLie1, 'text-fg/60')}
        {box('Another lie', 'and another', lie2, setLie2, 'text-fg/60', true)}
      </div>
      <button className={btnAccent} onClick={send} disabled={!ready}>
        Ready
      </button>
    </div>
  )
}
