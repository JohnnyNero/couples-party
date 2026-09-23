import type { ReactNode } from 'react'
import type { PuzzleView } from './api'
import { api } from './api'
import { localDate } from './dates'
import { PairStart, PairWaiting } from './Pairing'
import { TileRow } from './Tiles'
import type { useDaily } from './useDaily'
import { MAX_GUESSES } from './wordle'

export type DailyScreen =
  | { kind: 'play'; puzzle: PuzzleView; partner: string }
  | { kind: 'set'; partner: string; forDate: string; when: 'today' | 'tomorrow' }

// The top of the Today tab: the daily puzzle, in whatever state the two of you are in.
// Not paired → pair. Waiting → the code. Paired → the word they set you, and setting
// theirs.
export function DailyCard({
  daily,
  open,
}: {
  daily: ReturnType<typeof useDaily>
  open: (screen: DailyScreen) => void
}) {
  const { status, refresh } = daily

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
      <Card title="Their Word" sub="A daily puzzle your partner makes for you">
        <p className="text-sm text-fg/60 mb-4">
          Link your two phones once. Then every day you answer a question in five letters,
          and tomorrow they solve it as a Wordle — and you solve theirs.
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

  const { partner, toSolve, setToday, setNext } = d
  // Setting goes to today if they've nothing from you today — so on day one, or after a
  // missed day, they can play straight away — otherwise it's tomorrow's.
  const target = setToday ? { forDate: localDate(1), when: 'tomorrow' as const } : { forDate: localDate(0), when: 'today' as const }
  const pending = setToday ? setNext : setToday
  const setIt = () => open({ kind: 'set', partner, ...target })

  return (
    <Card title="Their Word" sub={`From ${partner}`}>
      {toSolve ? (
        <SolveRow puzzle={toSolve} partner={partner} onPlay={() => open({ kind: 'play', puzzle: toSolve, partner })} />
      ) : (
        <div className="text-fg/60">
          {partner} hasn't set you one yet today.
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-fg/10 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.6rem] uppercase tracking-[0.3em] text-fg/40">For {partner}, {target.when}</div>
          <div className="text-sm text-fg/70 truncate">
            {pending?.answer ? (
              <>You set <b className="uppercase tracking-wider text-fg">{pending.answer}</b></>
            ) : (
              'Nothing set yet'
            )}
          </div>
        </div>
        {!pending || pending.guesses.length === 0 ? (
          <button
            onClick={setIt}
            className={
              'shrink-0 min-h-[44px] px-4 rounded-xl font-bold uppercase tracking-widest text-sm active:translate-y-px ' +
              (pending ? 'border-2 border-fg/20 text-fg/70' : 'bg-accent text-bg')
            }
          >
            {pending ? 'Change' : 'Set it'}
          </button>
        ) : null}
      </div>

      {setToday && (
        <Progress
          puzzle={setToday}
          partner={partner}
          onChange={() => open({ kind: 'set', partner, forDate: localDate(0), when: 'today' })}
        />
      )}

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

function SolveRow({ puzzle, partner, onPlay }: { puzzle: PuzzleView; partner: string; onPlay: () => void }) {
  const open = puzzle.status === 'open'
  const last = puzzle.patterns[puzzle.patterns.length - 1]
  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold leading-snug">{partner}'s answer to “{puzzle.prompt}”</div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TileRow letters={open ? '' : (puzzle.answer ?? '')} pattern={open ? last : puzzle.status === 'solved' ? 'ggggg' : '.....'} size="sm" />
          <span className="text-xs uppercase tracking-widest text-fg/50">
            {open
              ? puzzle.guesses.length
                ? `${puzzle.guesses.length} of ${MAX_GUESSES}`
                : 'Not started'
              : puzzle.status === 'solved'
                ? `In ${puzzle.guesses.length}`
                : 'Missed'}
          </span>
        </div>
        <button
          onClick={onPlay}
          className={
            'shrink-0 min-h-[44px] px-5 rounded-xl font-bold uppercase tracking-widest text-sm active:translate-y-px ' +
            (open ? 'bg-accent text-bg' : 'border-2 border-fg/20 text-fg/70')
          }
        >
          {open ? (puzzle.guesses.length ? 'Carry on' : 'Play') : 'See it'}
        </button>
      </div>
    </div>
  )
}

// The one you set them for today, and how they're getting on with it. Changeable until
// they've made a guess.
function Progress({ puzzle, partner, onChange }: { puzzle: PuzzleView; partner: string; onChange: () => void }) {
  const text =
    puzzle.status === 'solved'
      ? `${partner} got yours in ${puzzle.guesses.length}`
      : puzzle.status === 'failed'
        ? `${partner} didn't get yours`
        : puzzle.guesses.length
          ? `${partner} is on guess ${puzzle.guesses.length + 1}`
          : `${partner} hasn't started yours`
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[0.6rem] uppercase tracking-[0.3em] text-fg/40">
          Yours for {partner} today · <b className="text-fg/70 tracking-wider">{puzzle.answer}</b>
        </div>
        <div className="text-sm text-fg/70">{text}</div>
      </div>
      {puzzle.status === 'open' && puzzle.guesses.length === 0 ? (
        <button onClick={onChange} className="shrink-0 min-h-[40px] px-3 rounded-xl border-2 border-fg/15 text-fg/60 text-xs font-bold uppercase tracking-widest active:translate-y-px">
          Change
        </button>
      ) : (
        <TileRow letters="" pattern={puzzle.patterns[puzzle.patterns.length - 1]} size="sm" />
      )}
    </div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-fg/15 p-6">
      <div className="mb-4">
        {sub && <div className="text-[0.6rem] uppercase tracking-[0.25em] text-fg/40 mb-1">{sub}</div>}
        <h2 className="font-display text-3xl font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}
