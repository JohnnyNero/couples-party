import { useEffect, useState, type ReactNode } from 'react'
import type { Top5View } from './api'
import { BigButton, Card, SmallButton, Step } from './CardKit'
import { localDate } from './dates'
import { renderQuestion } from './question'
import { QuestionSpin } from './Spin'
import { fiveify, itemsOfTheDay, themeOfTheDay } from './top5'
import type { useDailyTop5 } from './useDaily'
import { loadPacks } from '../packs'
import type { Theme } from '../engine/state'

export type Top5Screen =
  | { kind: 'play'; puzzle: Top5View; partner: string; theme: string }
  | { kind: 'answer'; partner: string; theme: string; items: string[] }

// Top 5's own card — a daily Shortlist, next to Their Word and The Dial. Independent
// for now; see docs/ROADMAP.md.
export function Top5Card({
  daily,
  open,
  corner,
}: {
  daily: ReturnType<typeof useDailyTop5>
  open: (screen: Top5Screen) => void
  corner?: ReactNode // the streak, shown whichever puzzle is up
}) {
  const { status, refresh } = daily
  const [themes, setThemes] = useState<Theme[]>([])
  useEffect(() => { void loadPacks().then((c) => setThemes(c.themes)) }, [])

  if (status.kind === 'loading') {
    return <Card title="Top 5"><div className="h-24 grid place-items-center text-fg/30 animate-pulse">…</div></Card>
  }
  if (status.kind === 'error') {
    // Their Word already explains a setup problem on the same tab.
    if (status.error.kind === 'setup') return null
    return (
      <Card title="Top 5">
        <div className="text-sm text-fg/60">{status.error.message}</div>
        <button onClick={() => void refresh()} className="mt-3 text-sm uppercase tracking-widest text-accent-ink font-bold">
          Try again
        </button>
      </Card>
    )
  }

  const d = status.data
  if (d.state === 'single' || d.state === 'waiting') return null // Their Word carries pairing

  const { partner, mine, theirs } = d
  const pickedTheme = themeOfTheDay(localDate(), themes)
  const theme = d.prompt ?? (pickedTheme ? fiveify(renderQuestion(pickedTheme.text, partner)) : null)
  if (!theme || !pickedTheme) {
    return <Card title="Top 5"><div className="h-24 grid place-items-center text-fg/30 animate-pulse">…</div></Card>
  }
  const dayItems = itemsOfTheDay(localDate(), pickedTheme)
  const theirsOpen = theirs && !('locked' in theirs) ? theirs : null

  return (
    <Card title="Top 5" sub="Today's five" corner={corner}>
      <QuestionSpin
        today={localDate()}
        question={theme}
        pool={themes.map((t) => fiveify(renderQuestion(t.text, partner)))}
        storageKey="couples-party:spun:top5"
      />

      <div className="mt-5 flex flex-col gap-3">
        <Step n={1} label="You">
          {mine ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/70">Ranked</span>
              {mine.guess === null ? (
                <SmallButton onClick={() => open({ kind: 'answer', partner, theme, items: mine.items })}>Change</SmallButton>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/60">Rank them for real, for {partner} to guess</span>
              <BigButton onClick={() => open({ kind: 'answer', partner, theme, items: dayItems })}>Rank</BigButton>
            </div>
          )}
        </Step>

        <Step n={2} label={partner}>
          {!theirs ? (
            <span className="text-sm text-fg/50">{partner} hasn't ranked one yet</span>
          ) : !theirsOpen ? (
            <span className="text-sm text-fg/70">
              {partner} has ranked theirs — <b>rank yours to unlock it</b>
            </span>
          ) : (
            <TheirRow puzzle={theirsOpen} onPlay={() => open({ kind: 'play', puzzle: theirsOpen, partner, theme })} />
          )}
        </Step>
      </div>

      {mine && theirsOpen && <Progress puzzle={mine} partner={partner} />}
    </Card>
  )
}

function TheirRow({ puzzle, onPlay }: { puzzle: Top5View; onPlay: () => void }) {
  const open = puzzle.status === 'open'
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-fg/70">{open ? 'Ready to guess' : outcome(puzzle.exact!, puzzle.near!)}</span>
      {open ? <BigButton onClick={onPlay}>Guess</BigButton> : <SmallButton onClick={onPlay}>See it</SmallButton>}
    </div>
  )
}

function Progress({ puzzle, partner }: { puzzle: Top5View; partner: string }) {
  const text =
    puzzle.status === 'solved'
      ? `${partner} guessed yours — ${outcome(puzzle.exact!, puzzle.near!).toLowerCase()}`
      : `${partner} hasn't guessed yours yet`
  return <div className="mt-4 pt-3 border-t border-fg/10 text-sm text-fg/60">{text}</div>
}

// The same feel as the live game's per-item scoring, said as one line rather than
// added up into points — there's no session score here, just how close it landed.
export function outcome(exact: number, near: number): string {
  if (exact === 5) return 'All five, exactly'
  if (exact === 0 && near === 0) return 'Not one close'
  const parts = [exact > 0 && `${exact} exact`, near > 0 && `${near} close`].filter(Boolean)
  return parts.join(', ')
}
