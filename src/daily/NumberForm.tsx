import { useState } from 'react'
import { KeyField } from '../ui/keys'

// Five questions, a number box each — used for answering your own and for guessing
// theirs. Whole numbers only; the send button waits until all five are filled. Typed on
// our number pad — the screen around it is the <Keys>.
export function NumberForm({
  questions,
  show = (q) => q,
  onSubmit,
  label,
  busy = false,
}: {
  questions: string[]
  show?: (q: string) => string // how each reads to you — see say
  onSubmit: (values: number[]) => void
  label: string
  busy?: boolean
}) {
  const [values, setValues] = useState<string[]>(questions.map(() => ''))
  const ready = values.every((v) => /^\d{1,4}$/.test(v))

  return (
    <div className="flex flex-col gap-3">
      {questions.map((q, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-fg/[0.04] px-4 py-3">
          <span className="flex-1 min-w-0 text-sm leading-snug">{show(q)}</span>
          <KeyField
            mode="number"
            label={show(q)}
            className="w-20 shrink-0 min-h-[44px] rounded-xl border-2 border-fg bg-card text-center text-xl font-bold tabular-nums"
            value={values[i]}
            onChange={(v) => setValues((prev) => prev.map((old, j) => (j === i ? v : old)))}
            maxLength={4}
            autoFocus={i === 0}
            disabled={busy}
          />
        </div>
      ))}
      <button
        className="mt-1 w-full min-h-[56px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold press disabled:opacity-40"
        onClick={() => onSubmit(values.map(Number))}
        disabled={!ready || busy}
      >
        {label}
      </button>
    </div>
  )
}
