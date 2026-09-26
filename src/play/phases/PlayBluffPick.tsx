import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { dispatch, useLive } from '../../net'
import { playerName } from '../../views/list'
import { bluffOptions, bluffPrompt, bluffLiveKey } from '../../views/bluff'
import { useLiveSender } from '../../views/useLiveSender'
import { Avatar, inkOf } from '../../ui/Avatar'
import { btnAccent, eyebrow } from '../../ui/styles'

// One of you's three, shuffled. The other taps the one they think is true — and can
// change their mind until they lock it in — while the one they belong to watches their
// choice move, with the truth marked, keeping a straight face.
export function PlayBluffPick({ s, me }: { s: SessionState; me: PlayerId }) {
  const round = s.bluff!.rounds[s.bluff!.current]
  const owner = round.turn
  const guesser = other(owner)
  const mine = owner === me
  const key = bluffLiveKey(s)
  const [sel, setSel] = useState<number | null>(null)
  const send = useLiveSender(key)
  const live = useLive(key)
  const leaning = mine ? (typeof live === 'number' ? live : null) : sel
  const options = bluffOptions(round, owner)

  return (
    <div className="h-full flex flex-col px-5 pb-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center gap-3 py-4">
        <div className="flex items-center gap-2">
          <Avatar p={owner} name={playerName(s, owner)} size="sm" />
          <span className={eyebrow}>{mine ? `${playerName(s, guesser)} is picking` : 'Which one’s true?'}</span>
        </div>
        <div className="font-display text-[1.75rem] font-extrabold leading-[1.1] tracking-tight break-words">{bluffPrompt(s, round, owner, me)}</div>
        <div className="flex flex-col gap-2.5 mt-2">
          {options.map((o) => {
            const on = leaning === o.id
            if (mine) {
              const truth = o.id === 0
              return (
                <div
                  key={o.id}
                  className={
                    'rounded-2xl border-2 px-4 py-3.5 flex items-center gap-3 transition-colors ' +
                    (on ? 'border-pb bg-pb-soft' : truth ? 'border-sage-ink/50 bg-sage-soft' : 'border-fg/15')
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className={'font-display text-lg font-extrabold leading-tight break-words ' + (truth || on ? '' : 'text-fg/60')}>{o.text}</div>
                    <div className={'text-xs font-bold mt-0.5 ' + (truth ? 'text-sage-ink' : 'text-fg/40')}>{truth ? 'Your truth' : 'Your lie'}</div>
                  </div>
                  {on && <Avatar p={guesser} name={playerName(s, guesser)} size="sm" className="shrink-0 animate-pop" />}
                </div>
              )
            }
            return (
              <button
                key={o.id}
                onClick={() => { setSel(o.id); send(o.id) }}
                aria-pressed={on}
                className={
                  'text-left rounded-2xl border-2 px-4 py-4 font-display text-xl font-extrabold leading-tight break-words active:translate-y-px transition-colors ' +
                  (on ? `border-transparent ${me === 'A' ? 'bg-pa' : 'bg-pb'} text-white` : 'border-fg bg-card shadow-[3px_3px_0_rgba(0,0,0,0.12)] ' + inkOf(owner))
                }
              >
                {o.text}
              </button>
            )
          })}
        </div>
        {mine && (
          <div className="text-sm text-fg/55 text-center mt-2">
            {leaning === null ? 'Poker face.' : leaning === 0 ? 'They’re on your truth… poker face.' : 'They’re on a lie. Stay calm.'}
          </div>
        )}
      </div>
      {!mine && (
        <button className={btnAccent} disabled={sel === null} onClick={() => { if (sel !== null) dispatch({ type: 'PICK_BLUFF', player: me, choice: sel }) }}>
          Lock it in
        </button>
      )}
    </div>
  )
}
