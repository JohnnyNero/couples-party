import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { dispatch } from '../../net'
import { aboutPartner } from '../../views/voice'
import { playerName } from '../../views/list'
import { Avatar } from '../../ui/Avatar'
import { btnAccent } from '../../ui/styles'
import { PromptCard } from '../../ui/kit'
import { capital } from '../../screen/phases/ScreenFingerRound'
import { PlayWaiting } from './PlayWaiting'

// Called It: is it true for you — and your call on whether it's true for them. Both go
// together, so neither of you sees the other's before calling it.
export function PlayFingerRound({ s, me }: { s: SessionState; me: PlayerId }) {
  const f = s.finger!
  const round = f.rounds[f.current]
  const them = other(me)
  const [answer, setAnswer] = useState<boolean | null>(null)
  const [predict, setPredict] = useState<boolean | null>(null)
  if (round.answer[me] !== null) {
    return <PlayWaiting label="Called it" sub={round.answer[them] !== null ? 'Revealing…' : `Waiting for ${playerName(s, them)}`} />
  }
  const row = (who: PlayerId, label: string, value: boolean | null, set: (v: boolean) => void) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <Avatar p={who} name={playerName(s, who)} size="sm" /> {label}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            onClick={() => set(v)}
            aria-pressed={value === v}
            className={
              'min-h-[56px] rounded-2xl border-2 font-display text-xl font-extrabold active:translate-y-px transition-colors ' +
              (value === v ? `${who === 'A' ? 'bg-pa' : 'bg-pb'} text-white border-transparent` : 'border-fg/20 bg-card')
            }
          >
            {v ? 'True' : 'Not true'}
          </button>
        ))}
      </div>
    </div>
  )
  const ready = answer !== null && predict !== null
  return (
    <div className="h-full flex flex-col px-5 pb-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center gap-5 py-4">
        <PromptCard over="Called it?" size="md">{capital(aboutPartner(s, round.statementId, me))}</PromptCard>
        {row(me, 'True for you?', answer, setAnswer)}
        {row(them, `And for ${playerName(s, them)}? Call it`, predict, setPredict)}
      </div>
      <button
        className={btnAccent}
        disabled={!ready}
        onClick={() => { if (ready) dispatch({ type: 'SUBMIT_CALLED', player: me, answer: answer!, predict: predict! }) }}
      >
        Lock them in
      </button>
    </div>
  )
}
