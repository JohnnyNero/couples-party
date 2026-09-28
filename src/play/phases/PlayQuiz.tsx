import { useRef, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { GUESS, TWIST } from '../../engine/phases'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { eyebrow } from '../../ui/styles'
import { KeyField, Keys } from '../../ui/keys'
import { PlayWaiting } from './PlayWaiting'

// Tongue Twisters, Higher or Lower and Guesstimate: the phone screens.

// ---------------------------------------------------------------- Tongue Twisters

// Whoever's turn it is says it out loud; the other judges. Both see the twister.
export function PlayTwist({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.twist!
  const round = g.rounds[g.current]
  const speaker = round.turn
  const mine = speaker === me
  return (
    <div className="h-full flex flex-col px-5 pb-6 gap-4 select-none">
      <div className="flex-1 flex flex-col justify-center gap-5 text-center">
        <div className={eyebrow + ' flex items-center justify-center gap-2'}>
          <Avatar p={speaker} name={playerName(s, speaker)} size="sm" />
          {mine ? `Your go · say it ${TWIST.times} times, fast` : `${playerName(s, speaker)}’s go · ${TWIST.times} times, fast`}
        </div>
        <div className={'font-display text-[2rem] leading-[1.15] font-extrabold tracking-tight break-words ' + (mine ? inkOf(me) : '')}>
          “{round.text}”
        </div>
        {mine && (
          <div className="text-base font-bold text-fg/60">Out loud! {playerName(s, other(me))} decides if you nailed it.</div>
        )}
      </div>
      {!mine && (
        <div className="flex gap-3">
          <button
            onClick={() => dispatch({ type: 'TWIST_JUDGE', player: me, nailed: false })}
            className="press flex-1 min-h-[64px] rounded-2xl border-2 border-fg bg-card font-display text-xl font-extrabold"
          >
            Tripped up
          </button>
          <button
            onClick={() => dispatch({ type: 'TWIST_JUDGE', player: me, nailed: true })}
            className="press flex-1 min-h-[64px] rounded-2xl bg-sage-ink text-white font-display text-xl font-extrabold"
          >
            Nailed it
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Higher or Lower

// Two cards; tap the one. Timed from when the question appeared on this phone.
export function PlayHigher({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.higher!
  const round = g.rounds[g.current]
  const shownAt = useRef(performance.now())
  const picked = round.pick[me]
  const [mine, setMine] = useState<'a' | 'b' | null>(null)
  const choice = picked ?? mine
  if (picked) return <PlayWaiting label="Locked in" sub={`Waiting for ${playerName(s, other(me))}`} />

  const pick = (p: 'a' | 'b') => {
    if (choice) return
    setMine(p)
    dispatch({ type: 'HL_PICK', player: me, pick: p, ms: performance.now() - shownAt.current })
  }
  return (
    <div className="h-full flex flex-col px-5 pb-6 gap-4 select-none">
      <div className="text-center">
        <div className={eyebrow}>Question {round.index} of {g.rounds.length}</div>
        <div className="mt-1 font-display text-3xl font-extrabold leading-tight">{round.item.question}</div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {(['a', 'b'] as const).map((side) => (
          <button
            key={side}
            onPointerDown={() => pick(side)}
            disabled={!!choice}
            className={
              'press flex-1 rounded-[1.75rem] border-2 border-fg px-4 font-display text-2xl font-extrabold leading-tight shadow-[4px_4px_0_rgba(0,0,0,0.12)] touch-none ' +
              (choice === side ? 'bg-fg text-bg' : choice ? 'bg-card opacity-40' : 'bg-card')
            }
          >
            {side === 'a' ? round.item.a : round.item.b}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Guesstimate

export function PlayGuess({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.guess!
  const round = g.rounds[g.current]
  const [value, setValue] = useState('')
  if (round.guess[me] !== null) return <PlayWaiting label="Locked in" sub={`Waiting for ${playerName(s, other(me))}`} />
  const send = () => { if (value) dispatch({ type: 'GUESS_SUBMIT', player: me, value: Number(value) }) }
  return (
    <Keys className="h-full" bodyClassName="px-5 pb-3">
      <div className="flex-1 flex flex-col justify-center gap-3 text-center">
        <div className={eyebrow}>Question {round.index} of {g.rounds.length}</div>
        <div className="font-display text-[1.9rem] font-extrabold leading-[1.12] tracking-tight break-words">{round.question}</div>
      </div>
      <KeyField
        mode="number"
        value={value}
        onChange={setValue}
        onEnter={send}
        enter="Guess"
        canEnter={!!value}
        maxLength={GUESS.maxDigits}
        className="w-full min-h-[64px] rounded-2xl border-2 border-fg bg-card px-4 font-display text-4xl font-extrabold tabular-nums justify-center"
        label="Your guess"
        autoFocus
      />
    </Keys>
  )
}
