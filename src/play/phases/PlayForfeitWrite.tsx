import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { FORFEIT } from '../../engine/phases'
import { dispatch } from '../../net/playroom'
import { PlayWaiting } from './PlayWaiting'

const PLACEHOLDERS = [
  'makes coffee for a week',
  'loses aux for a day',
  'texts their mum a compliment',
  'does the dishes all week',
  'gives up the good pillow',
]

export function PlayForfeitWrite({ s, me }: { s: SessionState; me: PlayerId }) {
  const mine = s.forfeits.filter((f) => f.authoredBy === me).length
  const [text, setText] = useState('')
  if (mine >= FORFEIT.targetEach) return <PlayWaiting label="All five in — waiting" />

  const submit = () => {
    const t = text.trim()
    if (t.length === 0) return
    dispatch({ type: 'SUBMIT_FORFEITS', player: me, text: t })
    setText('')
  }

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-4">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-1">The loser has to…</div>
        <div className="text-lg uppercase tracking-widest text-fg/70">
          {mine} of {FORFEIT.targetEach} written
        </div>
      </div>
      <input
        className="w-full min-h-[56px] text-lg bg-fg text-bg px-4 outline-none border-b-4 border-accent placeholder:text-bg/30"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        maxLength={FORFEIT.maxLen}
        placeholder={PLACEHOLDERS[mine] ?? 'something they have to do'}
        autoComplete="off"
      />
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={submit}
      >
        Lock it in
      </button>
      <div className="flex gap-2 justify-center pt-1">
        {Array.from({ length: FORFEIT.targetEach }).map((_, i) => (
          <span key={i} className={'h-3 w-3 ' + (i < mine ? 'bg-accent' : 'border-2 border-fg/30')} />
        ))}
      </div>
    </div>
  )
}
