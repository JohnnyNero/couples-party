import { useEffect, useState } from 'react'
import type { DialView } from './api'
import { BigButton, Card, SmallButton, Step } from './CardKit'
import { localDate } from './dates'
import { dialOfTheDay, spectrumPrompt } from './dial'
import { QuestionSpin } from './Spin'
import type { useDailyDial } from './useDaily'
import { loadPacks } from '../packs'
import type { WaveSpectrum } from '../engine/state'

export type DialScreen =
  | { kind: 'play'; puzzle: DialView; partner: string; spectrum: string }
  | { kind: 'answer'; partner: string; spectrum: string }

// The Dial's own card — Wavelength as a daily. Independent of Their Word for now (see
// docs/ROADMAP.md): its own pairing check, its own spin, its own steps. Once Top 5,
// Sketch and Their Numbers exist too, these become one rotating slot instead of two
// standing cards.
export function DialCard({
  daily,
  open,
}: {
  daily: ReturnType<typeof useDailyDial>
  open: (screen: DialScreen) => void
}) {
  const { status, refresh } = daily
  const [spectrums, setSpectrums] = useState<WaveSpectrum[]>([])
  useEffect(() => { void loadPacks().then((c) => setSpectrums(c.spectrums)) }, [])

  if (status.kind === 'loading') {
    return <Card title="The Dial"><div className="h-24 grid place-items-center text-fg/30 animate-pulse">…</div></Card>
  }
  if (status.kind === 'error') {
    // Their Word already explains a setup problem on the same tab — a second copy of
    // the same message right underneath it would just be noise.
    if (status.error.kind === 'setup') return null
    return (
      <Card title="The Dial">
        <div className="text-sm text-fg/60">{status.error.message}</div>
        <button onClick={() => void refresh()} className="mt-3 text-sm uppercase tracking-widest text-accent font-bold">
          Try again
        </button>
      </Card>
    )
  }

  const d = status.data
  if (d.state === 'single' || d.state === 'waiting') {
    // Their Word already carries the pairing flow on the same tab, so there's nothing
    // extra for this card to say until you're paired.
    return null
  }

  const { partner, mine, theirs } = d
  const picked = dialOfTheDay(localDate(), spectrums)
  const spectrum = d.prompt ?? (picked ? spectrumPrompt(picked) : null)
  if (!spectrum) {
    return <Card title="The Dial"><div className="h-24 grid place-items-center text-fg/30 animate-pulse">…</div></Card>
  }
  const theirsOpen = theirs && !('locked' in theirs) ? theirs : null

  return (
    <Card title="The Dial" sub="Today's spectrum">
      <QuestionSpin
        today={localDate()}
        question={spectrum}
        pool={spectrums.map(spectrumPrompt)}
        storageKey="couples-party:spun:dial"
      />

      <div className="mt-5 flex flex-col gap-3">
        <Step n={1} label="You">
          {mine ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/70 min-w-0 truncate">"{mine.clue}"</span>
              {mine.guess === null ? (
                <SmallButton onClick={() => open({ kind: 'answer', partner, spectrum })}>Change</SmallButton>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/60">Mark a point, then clue it, for {partner} to place</span>
              <BigButton onClick={() => open({ kind: 'answer', partner, spectrum })}>Set it</BigButton>
            </div>
          )}
        </Step>

        <Step n={2} label={partner}>
          {!theirs ? (
            <span className="text-sm text-fg/50">{partner} hasn't set one yet</span>
          ) : !theirsOpen ? (
            <span className="text-sm text-fg/70">
              {partner} has set theirs — <b>set yours to unlock it</b>
            </span>
          ) : (
            <TheirRow puzzle={theirsOpen} onPlay={() => open({ kind: 'play', puzzle: theirsOpen, partner, spectrum })} />
          )}
        </Step>
      </div>

      {mine && theirsOpen && <Progress puzzle={mine} partner={partner} />}
    </Card>
  )
}

function TheirRow({ puzzle, onPlay }: { puzzle: DialView; onPlay: () => void }) {
  const open = puzzle.status === 'open'
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-fg/70 truncate block">"{puzzle.clue}"</span>
        {!open && (
          <span className="text-[0.6rem] uppercase tracking-widest text-fg/50">{closeness(puzzle.distance!)}</span>
        )}
      </div>
      {open ? <BigButton onClick={onPlay}>Place it</BigButton> : <SmallButton onClick={onPlay}>See it</SmallButton>}
    </div>
  )
}

function Progress({ puzzle, partner }: { puzzle: DialView; partner: string }) {
  const text =
    puzzle.status === 'solved'
      ? `${partner} placed yours — ${closeness(puzzle.distance!).toLowerCase()}`
      : `${partner} hasn't placed yours yet`
  return (
    <div className="mt-4 pt-3 border-t border-fg/10 text-sm text-fg/60">
      {text}
    </div>
  )
}

// The same feel as the live game's tiers, in words rather than points — there's no
// score to add up here, just how it went.
export function closeness(distance: number): string {
  if (distance === 0) return 'Bullseye'
  if (distance <= 5) return 'So close'
  if (distance <= 15) return 'Not far off'
  return 'Miles off'
}
