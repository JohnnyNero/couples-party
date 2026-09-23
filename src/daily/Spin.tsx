import { useEffect, useMemo, useState } from 'react'
import { makeRng, shuffled } from '../engine/rng'

const LINE = 76 // px — room for a question on two lines

// Today's question landing like a fruit machine: a reel of other questions spins past
// and stops on the day's. It plays once per day per phone, per card — `storageKey`
// keeps Their Word and The Dial's spins independent, so opening one doesn't burn the
// other's — after that it's just the question, sitting still.
export function QuestionSpin({
  today,
  question,
  pool,
  storageKey = 'couples-party:spun',
}: {
  today: string
  question: string
  pool: string[]
  storageKey?: string
}) {
  // Read once, on mount. Re-reading it every render would see the "seen" mark this
  // very spin writes, and skip straight to the end before it had started.
  const [alreadySeen] = useState(() => {
    try { return localStorage.getItem(storageKey) === today } catch { return true }
  })
  const reel = useMemo(() => {
    const others = shuffled(makeRng(today.length + pool.length), pool.filter((q) => q !== question))
    return [...others, ...others, ...others].slice(0, 14).concat(question)
  }, [today, question, pool])
  const [landed, setLanded] = useState(alreadySeen)

  useEffect(() => {
    if (alreadySeen) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setLanded(true)))
    try { localStorage.setItem(storageKey, today) } catch { /* private mode: it spins every time */ }
    return () => cancelAnimationFrame(id)
  }, [alreadySeen, today, storageKey])

  // Same box as the reel's last line, so the card doesn't shift between the first open
  // of the day and every one after.
  if (alreadySeen) {
    return (
      <div style={{ height: LINE }} className="flex items-center font-display text-2xl font-bold leading-tight">
        {question}
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden" style={{ height: LINE }} aria-label={question}>
      <div
        style={{
          transform: `translateY(${landed ? -(reel.length - 1) * LINE : 0}px)`,
          transition: 'transform 2200ms cubic-bezier(0.12, 0.8, 0.14, 1)',
        }}
      >
        {reel.map((q, i) => (
          <div
            key={i}
            style={{ height: LINE }}
            className={
              'flex items-center font-display text-2xl font-bold leading-tight ' +
              (i === reel.length - 1 ? '' : 'text-fg/35')
            }
          >
            {q}
          </div>
        ))}
      </div>
    </div>
  )
}
