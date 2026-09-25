import { useEffect, useState, type ReactNode } from 'react'
import type { SketchView } from './api'
import { BigButton, Card, SmallButton, Step } from './CardKit'
import { localDate } from './dates'
import { SKETCH_GUESSES, sketchOfTheDay } from './sketch'
import { QuestionSpin } from './Spin'
import type { useDailySketch } from './useDaily'
import { loadPacks } from '../packs'
import type { DrawPrompt } from '../engine/state'

export type SketchScreen =
  | { kind: 'play'; puzzle: SketchView; partner: string; prompt: string }
  | { kind: 'answer'; partner: string; prompt: string }

// Draw Your Answer questions are bare noun phrases ("comfort food") — "Your comfort
// food" on the setter's side, "Sam's comfort food" on the solver's.
export const yours = (prompt: string) => `Your ${prompt}`
export const theirs = (prompt: string, name: string) => `${name}'s ${prompt}`

// Sketch's own card — a daily Draw Your Answer, next to the other three. Independent
// for now; see docs/ROADMAP.md.
export function SketchCard({
  daily,
  open,
  corner,
}: {
  daily: ReturnType<typeof useDailySketch>
  open: (screen: SketchScreen) => void
  corner?: ReactNode // the streak, shown whichever puzzle is up
}) {
  const { status, refresh } = daily
  const [pool, setPool] = useState<DrawPrompt[]>([])
  useEffect(() => { void loadPacks().then((c) => setPool(c.drawPrompts)) }, [])

  if (status.kind === 'loading') {
    return <Card title="Sketch"><div className="h-24 grid place-items-center text-fg/30 animate-pulse">…</div></Card>
  }
  if (status.kind === 'error') {
    if (status.error.kind === 'setup') return null // Their Word already says so
    return (
      <Card title="Sketch">
        <div className="text-sm text-fg/60">{status.error.message}</div>
        <button onClick={() => void refresh()} className="mt-3 text-sm uppercase tracking-widest text-accent-ink font-bold">
          Try again
        </button>
      </Card>
    )
  }

  const d = status.data
  if (d.state === 'single' || d.state === 'waiting') return null // Their Word carries pairing

  const { partner, mine, theirs: theirsRaw } = d
  const prompt = d.prompt ?? sketchOfTheDay(localDate(), pool)
  if (!prompt) {
    return <Card title="Sketch"><div className="h-24 grid place-items-center text-fg/30 animate-pulse">…</div></Card>
  }
  const theirsOpen = theirsRaw && !('locked' in theirsRaw) ? theirsRaw : null

  return (
    <Card title="Sketch" sub="Today's question" corner={corner}>
      <QuestionSpin
        today={localDate()}
        question={yours(prompt)}
        pool={pool.map((p) => yours(p.text))}
        storageKey="couples-party:spun:sketch"
      />

      <div className="mt-5 flex flex-col gap-3">
        <Step n={1} label="You">
          {mine ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/70 min-w-0 truncate">Drew "{mine.answer}"</span>
              {mine.guesses.length === 0 ? (
                <SmallButton onClick={() => open({ kind: 'answer', partner, prompt })}>Change</SmallButton>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/60">Answer it, then draw it, for {partner} to guess</span>
              <BigButton onClick={() => open({ kind: 'answer', partner, prompt })}>Draw</BigButton>
            </div>
          )}
        </Step>

        <Step n={2} label={partner}>
          {!theirsRaw ? (
            <span className="text-sm text-fg/50">{partner} hasn't drawn one yet</span>
          ) : !theirsOpen ? (
            <span className="text-sm text-fg/70">
              {partner} has drawn theirs — <b>draw yours to unlock it</b>
            </span>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/70">{outcome(theirsOpen) ?? 'Ready to guess'}</span>
              {theirsOpen.status === 'open'
                ? <BigButton onClick={() => open({ kind: 'play', puzzle: theirsOpen, partner, prompt })}>{theirsOpen.guesses.length ? 'Carry on' : 'Guess'}</BigButton>
                : <SmallButton onClick={() => open({ kind: 'play', puzzle: theirsOpen, partner, prompt })}>See it</SmallButton>}
            </div>
          )}
        </Step>
      </div>

      {mine && theirsOpen && (
        <div className="mt-4 pt-3 border-t border-fg/10 text-sm text-fg/60">
          {mine.status === 'solved'
            ? `${partner} got yours in ${mine.guesses.length}`
            : mine.status === 'failed'
              ? `${partner} didn't get yours`
              : mine.guesses.length
                ? `${partner} is on guess ${mine.guesses.length + 1} of ${SKETCH_GUESSES}`
                : `${partner} hasn't guessed yours yet`}
        </div>
      )}
    </Card>
  )
}

function outcome(p: SketchView): string | null {
  if (p.status === 'solved') return `Got it in ${p.guesses.length}`
  if (p.status === 'failed') return `Missed — it was "${p.answer}"`
  if (p.guesses.length) return `${p.guesses.length} of ${SKETCH_GUESSES} used`
  return null
}
