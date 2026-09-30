import { useState } from 'react'
import { DailyError } from '../daily/api'
import { useProfile } from './store'
import { useRude } from './rude'

// The switch for rude questions (see ./rude). In a couple it's both of you, so it says so.
export function RudeRow() {
  const [on, set] = useRude()
  const profile = useProfile()
  const [note, setNote] = useState<string | null>(null)
  const partner = profile?.state === 'paired' ? profile.partner.name : null
  const flip = () => {
    setNote(null)
    set(!on).catch((e) => setNote(e instanceof DailyError ? e.message : 'Couldn’t save that — try again.'))
  }
  return (
    <div>
      <button
        role="switch"
        aria-checked={on}
        onClick={flip}
        className="w-full min-h-[56px] flex items-center gap-3 rounded-2xl border-2 border-fg/15 bg-card px-4 py-3 text-left press"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-fg/60" aria-hidden="true">
          <path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.8 1.5-3.7.3 1.3 1 2.2 2 2.7 0-2.8-.5-5.2.5-7.5z" />
          <path d="M8 20h8" />
        </svg>
        <span className="flex-1 min-w-0">
          <span className="block font-bold">Rude questions</span>
          <span className="block text-sm text-fg/55 leading-snug">
            A few cheeky ones, about sex.{partner ? ` For you and ${partner}.` : ''}
          </span>
        </span>
        <span className={'shrink-0 relative w-12 h-7 rounded-full transition-colors ' + (on ? 'bg-pa' : 'bg-fg/20')}>
          <span className={'absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ' + (on ? 'left-6' : 'left-1')} />
        </span>
      </button>
      {note && <div className="mt-1.5 text-sm font-bold text-pa-ink text-center" role="alert">{note}</div>}
    </div>
  )
}
