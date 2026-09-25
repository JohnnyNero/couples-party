import { useState } from 'react'

// Five questions, a number box each — used for answering your own and for guessing
// theirs. Whole numbers only; the send button waits until all five are filled.
export function NumberForm({
  questions,
  onSubmit,
  label,
  busy = false,
}: {
  questions: string[]
  onSubmit: (values: number[]) => void
  label: string
  busy?: boolean
}) {
  const [values, setValues] = useState<string[]>(questions.map(() => ''))
  const ready = values.every((v) => /^\d{1,4}$/.test(v))

  return (
    <div className="flex flex-col gap-3">
      {questions.map((q, i) => (
        <label key={i} className="flex items-center gap-3 rounded-2xl bg-fg/[0.04] px-4 py-3">
          <span className="flex-1 min-w-0 text-sm leading-snug">{q}</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={q}
            className="w-20 shrink-0 min-h-[44px] rounded-xl border-2 border-fg bg-card text-center text-xl font-bold tabular-nums outline-none focus:border-pa"
            value={values[i]}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
              setValues((prev) => prev.map((old, j) => (j === i ? v : old)))
            }}
            disabled={busy}
          />
        </label>
      ))}
      <button
        className="mt-1 w-full min-h-[56px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold active:translate-y-px disabled:opacity-40"
        onClick={() => onSubmit(values.map(Number))}
        disabled={!ready || busy}
      >
        {label}
      </button>
    </div>
  )
}
