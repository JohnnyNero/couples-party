import { useEffect, useState } from 'react'
import type { NumbersMark, NumbersView } from './api'
import { BigButton, Card, SmallButton, Step } from './CardKit'
import { localDate } from './dates'
import { numbersOfTheDay } from './numbers'
import type { useDailyNumbers } from './useDaily'
import { loadNumberQuestions } from '../packs'

export type NumbersScreen =
  | { kind: 'play'; puzzle: NumbersView; partner: string }
  | { kind: 'answer'; partner: string; questions: string[] }

// Their Numbers' own card — the last of the four, next to the others. Independent for
// now; see docs/ROADMAP.md.
export function NumbersCard({
  daily,
  open,
}: {
  daily: ReturnType<typeof useDailyNumbers>
  open: (screen: NumbersScreen) => void
}) {
  const { status, refresh } = daily
  const [pool, setPool] = useState<string[]>([])
  useEffect(() => { void loadNumberQuestions().then(setPool) }, [])

  if (status.kind === 'loading') {
    return <Card title="Their Numbers"><div className="h-24 grid place-items-center text-fg/30 animate-pulse">…</div></Card>
  }
  if (status.kind === 'error') {
    if (status.error.kind === 'setup') return null // Their Word already says so
    return (
      <Card title="Their Numbers">
        <div className="text-sm text-fg/60">{status.error.message}</div>
        <button onClick={() => void refresh()} className="mt-3 text-sm uppercase tracking-widest text-accent font-bold">
          Try again
        </button>
      </Card>
    )
  }

  const d = status.data
  if (d.state === 'single' || d.state === 'waiting') return null // Their Word carries pairing

  const { partner, mine, theirs } = d
  const questions = d.questions ?? numbersOfTheDay(localDate(), pool)
  if (!questions) {
    return <Card title="Their Numbers"><div className="h-24 grid place-items-center text-fg/30 animate-pulse">…</div></Card>
  }
  const theirsOpen = theirs && !('locked' in theirs) ? theirs : null

  return (
    <Card title="Their Numbers" sub="Today's five">
      <ul className="flex flex-col gap-1 text-sm text-fg/70">
        {questions.map((q) => <li key={q}>· {q}</li>)}
      </ul>

      <div className="mt-5 flex flex-col gap-3">
        <Step n={1} label="You">
          {mine ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/70 tabular-nums">{mine.answers?.join(' · ')}</span>
              {mine.guesses === null ? (
                <SmallButton onClick={() => open({ kind: 'answer', partner, questions: mine.questions })}>Change</SmallButton>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/60">Five numbers about you, for {partner} to guess</span>
              <BigButton onClick={() => open({ kind: 'answer', partner, questions })}>Answer</BigButton>
            </div>
          )}
        </Step>

        <Step n={2} label={partner}>
          {!theirs ? (
            <span className="text-sm text-fg/50">{partner} hasn't answered yet</span>
          ) : !theirsOpen ? (
            <span className="text-sm text-fg/70">
              {partner} has answered — <b>answer yours to unlock it</b>
            </span>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/70">{theirsOpen.marks ? summary(theirsOpen.marks) : 'Ready to guess'}</span>
              {theirsOpen.status === 'open'
                ? <BigButton onClick={() => open({ kind: 'play', puzzle: theirsOpen, partner })}>Guess</BigButton>
                : <SmallButton onClick={() => open({ kind: 'play', puzzle: theirsOpen, partner })}>See it</SmallButton>}
            </div>
          )}
        </Step>
      </div>

      {mine && theirsOpen && (
        <div className="mt-4 pt-3 border-t border-fg/10 text-sm text-fg/60">
          {mine.marks ? `${partner} guessed yours — ${summary(mine.marks).toLowerCase()}` : `${partner} hasn't guessed yours yet`}
        </div>
      )}
    </Card>
  )
}

export function summary(marks: NumbersMark[]): string {
  const exact = marks.filter((m) => m === 'exact').length
  const close = marks.filter((m) => m === 'close').length
  if (exact === marks.length) return 'All five, exactly'
  if (exact === 0 && close === 0) return 'Not one close'
  return [exact > 0 && `${exact} exact`, close > 0 && `${close} close`].filter(Boolean).join(', ')
}
