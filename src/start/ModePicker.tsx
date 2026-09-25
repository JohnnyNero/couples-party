import type { ReactNode } from 'react'
import type { PlayMode } from './mode'
import type { Game } from '../engine/state'
import { GAME_LABELS } from '../engine/roster'
import { eyebrow } from '../ui/styles'

const GAME_NAMES: Partial<Record<Game, string>> = { tonight: 'Tonight', full: 'The full session' }

// How tonight is being played. Two real choices, drawn big; solo play is a testing seat,
// so it's a quiet link rather than a third choice.
export function ModePicker({
  game,
  onPick,
  onBack,
}: {
  game: Game
  onPick: (m: PlayMode, bot?: boolean) => void
  onBack?: () => void
}) {
  const name = GAME_NAMES[game] ?? (game in GAME_LABELS ? GAME_LABELS[game as keyof typeof GAME_LABELS] : '')
  return (
    <div className="h-full w-full flex flex-col select-none px-5 pt-5 pb-7 max-w-xl mx-auto">
      <header className="flex items-center gap-3 pr-10">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-11 h-11 rounded-full border-2 border-fg/20 inline-flex items-center justify-center active:translate-y-px"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        <span className={eyebrow}>{name}</span>
      </header>

      <h1 className="mt-10 mb-6 font-display text-[2.1rem] font-extrabold leading-[1.05] tracking-tight">How are you playing tonight?</h1>

      <div className="flex flex-col gap-4">
        <Choice
          onClick={() => onPick('duo')}
          highlight
          art={<PhonesArt />}
          tone="bg-pa-soft"
          title="Two phones"
          sub="Each of you on your own"
          body="If you're paired, the other phone joins straight in — nothing to share."
          badge="Usual"
        />
        <Choice
          onClick={() => onPick('screen')}
          art={<TvArt />}
          tone="bg-pb-soft"
          title="With a TV"
          sub="The big screen is the board"
          body="Open this on the TV or laptop. Your phones become the controllers."
        />
      </div>

      <div className="flex-1" />
      <button onClick={() => onPick('solo', true)} className="self-center min-h-[44px] text-sm font-extrabold text-fg/50 active:translate-y-px">
        Testing on your own? Play the bot
      </button>
    </div>
  )
}

function Choice({ onClick, highlight = false, art, tone, title, sub, body, badge }: {
  onClick: () => void; highlight?: boolean; art: ReactNode; tone: string; title: string; sub: string; body: string; badge?: string
}) {
  return (
    <button
      onClick={onClick}
      className={
        'text-left rounded-[1.75rem] border-2 border-fg bg-card p-5 flex flex-col gap-3.5 active:translate-y-px ' +
        (highlight ? 'shadow-[5px_5px_0_rgb(var(--pa))]' : 'shadow-[4px_4px_0_rgba(0,0,0,0.12)]')
      }
    >
      <div className="flex items-center gap-3">
        <span className={'shrink-0 w-16 h-16 rounded-[1.1rem] inline-flex items-center justify-center ' + tone}>{art}</span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[1.4rem] font-extrabold leading-tight">{title}</div>
          <div className="text-sm text-fg/60">{sub}</div>
        </div>
        {badge && <span className="shrink-0 px-2.5 py-1 rounded-full bg-pa text-white text-[0.7rem] font-extrabold">{badge}</span>}
      </div>
      <div className="text-sm leading-relaxed text-fg/75">{body}</div>
    </button>
  )
}

function PhonesArt() {
  return (
    <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="6" width="13" height="25" rx="3" className="stroke-pa-ink" />
      <rect x="22" y="9" width="13" height="25" rx="3" className="stroke-pb-ink" />
      <path d="M10 27h3M27 30h3" className="stroke-fg" />
    </svg>
  )
}

function TvArt() {
  return (
    <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="6" width="32" height="20" rx="3" className="stroke-pb-ink" />
      <path d="M14 31h12" className="stroke-pb-ink" />
      <rect x="8" y="22" width="7" height="13" rx="2" className="stroke-pa-ink fill-card" />
      <rect x="25" y="22" width="7" height="13" rx="2" className="stroke-pa-ink fill-card" />
    </svg>
  )
}
