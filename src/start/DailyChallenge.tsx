import { useState } from 'react'
import { GAME_LABELS, roster } from '../engine/roster'
import { dayIndex, localDate } from '../daily/dates'
import { dailyNumber } from '../share/daily'
import { loadDaily } from '../share/dailyResult'
import { ShareButton } from '../share/ShareButton'
import { GameGlyph } from '../ui/GameIcon'
import { card, eyebrow } from '../ui/styles'

// Today's daily challenge: the same short set for every couple, numbered, once a day —
// so it's the thing you can compare with friends ("did you do #12?"). Once you've
// played, it shows how you did and a Share, until tomorrow's.
const SHORT: Partial<Record<string, string>> = {
  finger: 'Called It', meld: 'Mind Meld', wave: 'Wavelength', mrmrs: 'Mr & Mrs', clash: 'Clash',
  describe: 'Describe It', chain: 'Word Chain', clock: 'Stop the Clock', circle: 'Circle',
}

export function DailyChallenge({ onPlay }: { onPlay: () => void }) {
  const day = dayIndex(localDate())
  const n = dailyNumber(day)
  const [done] = useState(() => loadDaily(day))
  const lineup = roster('daily', day)
  if (done) {
    return (
      <section className={card + ' p-5 flex flex-col gap-3'}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={eyebrow}>The daily · #{n}</div>
            <div className="mt-1 font-display text-2xl font-extrabold leading-tight">Done for today ✓</div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-extrabold tabular-nums text-tan-ink leading-none">{done.together}</div>
            <div className="text-xs font-extrabold text-tan-ink">{done.tier ?? 'together'}</div>
          </div>
        </div>
        <div className="text-sm font-bold text-fg/60">
          {done.names.A} {done.scores.A} – {done.scores.B} {done.names.B} · a new one tomorrow
        </div>
        <ShareButton data={done} label="Share our daily" />
      </section>
    )
  }
  return (
    <section className={card + ' p-5 flex flex-col gap-3.5'}>
      <div>
        <div className={eyebrow}>The daily · #{n}</div>
        <div className="mt-1 font-display text-2xl font-extrabold leading-tight">The same three for every couple</div>
        <div className="mt-0.5 text-sm text-fg/60">About three minutes · then compare with your friends</div>
      </div>
      <div className="flex gap-2">
        {lineup.map((e) => (
          <div key={e.key} className="flex-1 min-w-0 flex flex-col items-center gap-1 rounded-2xl bg-fg/[0.05] px-2 py-2">
            <GameGlyph game={e.key} className="w-5 h-5 shrink-0" />
            <span className="text-[0.7rem] font-bold truncate max-w-full">{SHORT[e.key] ?? GAME_LABELS[e.key]}</span>
          </div>
        ))}
      </div>
      <button onClick={onPlay} className="press w-full min-h-[52px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold">
        Play #{n}
      </button>
    </section>
  )
}
