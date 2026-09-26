import { useState } from 'react'
import type { PlayerId } from '../engine/state'
import { fillOf, inkOf } from '../ui/Avatar'

const ringOf = (p: PlayerId) => (p === 'A' ? 'ring-pa' : 'ring-pb')
import { sides } from './either'

// Five pairs, a pair of big buttons each — for picking your own and for predicting
// theirs. The send button waits until every pair has a pick.
export function PickForm({
  questions,
  onSubmit,
  label,
  busy = false,
  p,
}: {
  questions: string[]
  onSubmit: (picks: number[]) => void
  label: string
  busy?: boolean
  p: PlayerId // whose colour a pick shows in: yours when picking, theirs when predicting
}) {
  const [picks, setPicks] = useState<(number | null)[]>(questions.map(() => null))
  const ready = picks.every((x) => x !== null)

  return (
    <div className="flex flex-col gap-3">
      {questions.map((q, i) => {
        const [a, b] = sides(q)
        return (
          <div key={i} role="radiogroup" aria-label={`${a} or ${b}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {[a, b].map((side, j) => {
              const on = picks[i] === j
              return (
                <button
                  key={j}
                  role="radio"
                  aria-checked={on}
                  disabled={busy}
                  onClick={() => setPicks((prev) => prev.map((old, k) => (k === i ? j : old)))}
                  className={
                    'min-h-[56px] rounded-2xl border-2 px-3 py-2 font-display text-base font-extrabold leading-tight active:translate-y-px transition-colors ' +
                    (j === 1 ? 'col-start-3 row-start-1 ' : '') +
                    (on ? `${fillOf(p)} text-white border-transparent` : 'border-fg/20 bg-card')
                  }
                >
                  {side}
                </button>
              )
            })}
            <span className="col-start-2 row-start-1 text-[0.65rem] font-extrabold uppercase tracking-widest text-fg/35">or</span>
          </div>
        )
      })}
      <button
        className="mt-1 w-full min-h-[56px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold active:translate-y-px disabled:opacity-40"
        onClick={() => onSubmit(picks.map((x) => x ?? 0))}
        disabled={!ready || busy}
      >
        {label}
      </button>
    </div>
  )
}

// The reveal: each pair with the setter's pick filled in their colour and the guess
// outlined in the guesser's, matches in green.
export function EitherResult({
  questions,
  answers,
  guesses,
  setter,
  guesser,
}: {
  questions: string[]
  answers: number[]
  guesses: number[]
  setter: { p: PlayerId; name: string }
  guesser: { p: PlayerId; name: string }
}) {
  return (
    <div className="w-full flex flex-col gap-2.5">
      {questions.map((q, i) => {
        const match = answers[i] === guesses[i]
        const pair = sides(q)
        return (
          <div key={i} className={'rounded-2xl border-2 px-3 py-2.5 ' + (match ? 'border-sage-ink bg-sage-soft' : 'border-fg/15 bg-card')}>
            <div className="grid grid-cols-2 gap-2">
              {pair.map((side, j) => (
                <div
                  key={j}
                  className={
                    'rounded-xl px-2.5 py-2 text-center font-display font-extrabold leading-tight ' +
                    (answers[i] === j ? `${fillOf(setter.p)} text-white` : guesses[i] === j ? `ring-2 ring-inset ${ringOf(guesser.p)} ${inkOf(guesser.p)}` : 'text-fg/45')
                  }
                >
                  {side}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs font-bold">
              <span className={inkOf(setter.p)}>{setter.name}: {pair[answers[i]]}</span>
              <span className={match ? 'text-sage-ink' : inkOf(guesser.p)}>
                {match ? '✓ ' : ''}{guesser.name === 'You' ? 'You said' : `${guesser.name} said`} {pair[guesses[i]]}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
