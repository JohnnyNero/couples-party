import { useEffect, useState, type ReactNode } from 'react'
import type { PuzzleView } from './api'
import { api } from './api'
import { localDate } from './dates'
import { PairStart, PairWaiting } from './Pairing'
import { questionOfTheDay, renderQuestion } from './question'
import { QuestionSpin } from './Spin'
import { TileRow } from './Tiles'
import type { useDaily } from './useDaily'
import { MAX_GUESSES } from './wordle'
import { loadWordPrompts } from '../packs'

export type DailyScreen =
  | { kind: 'play'; puzzle: PuzzleView; partner: string; question: string; mine: string | null }
  | { kind: 'answer'; partner: string; template: string; question: string }

// The top of the Today tab. Not paired → pair. Waiting → the code. Paired → today's
// question, your answer, and theirs — which stays locked until you've given yours.
export function DailyCard({
  daily,
  open,
}: {
  daily: ReturnType<typeof useDaily>
  open: (screen: DailyScreen) => void
}) {
  const { status, refresh } = daily
  const [pool, setPool] = useState<string[]>([])
  useEffect(() => { void loadWordPrompts().then(setPool) }, [])

  if (status.kind === 'loading') {
    return <Card title="Their Word"><div className="h-24 grid place-items-center text-fg/30 animate-pulse">…</div></Card>
  }
  if (status.kind === 'error') {
    return (
      <Card title="Their Word">
        <div className="text-sm text-fg/60">{status.error.message}</div>
        {status.error.kind !== 'setup' && (
          <button onClick={() => void refresh()} className="mt-3 text-sm uppercase tracking-widest text-accent font-bold">
            Try again
          </button>
        )}
      </Card>
    )
  }

  const d = status.data
  if (d.state === 'single') {
    return (
      <Card title="Their Word" sub="A daily word puzzle for two">
        <p className="text-sm text-fg/60 mb-4">
          Link your two phones once. Then every day you both answer the same question in
          five or six letters, and solve each other's as a Wordle.
        </p>
        <PairStart onDone={() => void refresh()} />
      </Card>
    )
  }
  if (d.state === 'waiting') {
    return (
      <Card title="Pair your phones">
        <PairWaiting code={d.code} onCancel={() => void refresh()} />
      </Card>
    )
  }

  const { partner, mine, theirs } = d
  // The server's question wins once either of you has answered; before that it's the
  // day's pick from the pool — the same on both phones.
  const template = d.question ?? questionOfTheDay(localDate(), pool)
  if (!template) {
    return <Card title="Their Word"><div className="h-24 grid place-items-center text-fg/30 animate-pulse">…</div></Card>
  }
  const question = renderQuestion(template, partner)
  const theirsOpen = theirs && !('locked' in theirs) ? theirs : null

  return (
    <Card title="Their Word" sub="Today's question">
      <QuestionSpin today={localDate()} question={question} pool={pool.map((q) => renderQuestion(q, partner))} />

      <div className="mt-5 flex flex-col gap-3">
        {/* 1 · You */}
        <Step n={1} label="You">
          {mine ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <TileRow letters={mine.answer ?? ''} length={mine.answer?.length ?? 5} size="sm" />
              </div>
              {mine.guesses.length === 0 ? (
                <SmallButton onClick={() => open({ kind: 'answer', partner, template, question })}>Change</SmallButton>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/60">Five or six letters, for {partner} to solve</span>
              <BigButton onClick={() => open({ kind: 'answer', partner, template, question })}>Answer</BigButton>
            </div>
          )}
        </Step>

        {/* 2 · Them */}
        <Step n={2} label={partner}>
          {!theirs ? (
            <span className="text-sm text-fg/50">{partner} hasn't answered yet</span>
          ) : !theirsOpen ? (
            <span className="text-sm text-fg/70">
              {partner} has answered — <b>answer yours to unlock it</b>
            </span>
          ) : (
            <TheirRow puzzle={theirsOpen} onPlay={() => open({ kind: 'play', puzzle: theirsOpen, partner, question: renderQuestion(template, d.me), mine: mine?.answer ?? null })} />
          )}
        </Step>
      </div>

      {mine && theirsOpen && <Progress puzzle={mine} partner={partner} />}

      <button
        onClick={async () => {
          if (confirm(`Unpair from ${partner}? Your puzzles go with it.`)) {
            await api.leaveCouple().catch(() => {})
            void refresh()
          }
        }}
        className="mt-5 text-[0.6rem] uppercase tracking-[0.3em] text-fg/25 active:text-fg/50"
      >
        Unpair
      </button>
    </Card>
  )
}

function TheirRow({ puzzle, onPlay }: { puzzle: PuzzleView; onPlay: () => void }) {
  const open = puzzle.status === 'open'
  const last = puzzle.patterns[puzzle.patterns.length - 1]
  const length = puzzle.length ?? 5
  const status = open
    ? puzzle.guesses.length ? `${puzzle.guesses.length} of ${MAX_GUESSES}` : ''
    : puzzle.status === 'solved' ? `Got it in ${puzzle.guesses.length}` : 'Missed'
  return (
    <div className="flex items-center justify-between gap-3">
      {/* The status sits under the tiles, not beside them — six tiles and a button leave
          no room across a small phone. */}
      <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
        <TileRow letters={open ? '' : (puzzle.answer ?? '')} pattern={open ? last : (puzzle.status === 'solved' ? 'g' : '.').repeat(length)} length={length} size="sm" />
        {status && <span className="text-[0.6rem] uppercase tracking-widest text-fg/50 whitespace-nowrap">{status}</span>}
      </div>
      {open ? (
        <BigButton onClick={onPlay}>{puzzle.guesses.length ? 'Carry on' : 'Play'}</BigButton>
      ) : (
        <SmallButton onClick={onPlay}>See it</SmallButton>
      )}
    </div>
  )
}

// How they're getting on with yours.
function Progress({ puzzle, partner }: { puzzle: PuzzleView; partner: string }) {
  const text =
    puzzle.status === 'solved'
      ? `${partner} got yours in ${puzzle.guesses.length}`
      : puzzle.status === 'failed'
        ? `${partner} didn't get yours`
        : puzzle.guesses.length
          ? `${partner} is on guess ${puzzle.guesses.length + 1} of yours`
          : `${partner} hasn't started yours`
  return (
    <div className="mt-4 pt-3 border-t border-fg/10 flex items-center justify-between gap-3 text-sm text-fg/60">
      <span className="shrink-0">{text}</span>
      {puzzle.guesses.length > 0 && <div className="flex-1 min-w-0 flex justify-end"><TileRow letters="" pattern={puzzle.patterns[puzzle.patterns.length - 1]} length={puzzle.patterns[0].length} size="sm" /></div>}
    </div>
  )
}

function Step({ n, label, children }: { n: number; label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-fg/[0.04] px-4 py-3">
      <div className="text-[0.6rem] uppercase tracking-[0.3em] text-fg/40 mb-1.5">
        <span className="text-accent font-bold">{n}</span> · {label}
      </div>
      {children}
    </div>
  )
}

function BigButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="shrink-0 min-h-[44px] px-5 rounded-xl bg-accent text-bg font-bold uppercase tracking-widest text-sm active:translate-y-px">
      {children}
    </button>
  )
}

function SmallButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="shrink-0 min-h-[40px] px-3 rounded-xl border-2 border-fg/15 text-fg/60 text-xs font-bold uppercase tracking-widest active:translate-y-px">
      {children}
    </button>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-fg/15 p-6">
      <div className="mb-3">
        {sub && <div className="text-[0.6rem] uppercase tracking-[0.25em] text-fg/40 mb-1">{sub}</div>}
        <h2 className="font-display text-3xl font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}
