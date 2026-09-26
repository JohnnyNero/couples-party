import { useState } from 'react'
import type { GameKey } from '../engine/state'
import { other } from '../engine/state'
import { GAME_LABELS } from '../engine/roster'
import { standing } from '../engine/standing'
import { headerInfo } from '../views/GameHeader'
import { clearSaved, loadSaved, type Saved } from '../store/progress'
import { GameIcon } from '../ui/GameIcon'

const SESSION_NAMES: Record<string, string> = { tonight: 'Tonight', full: 'The full session' }

function ago(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 2) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

// A game you left part-way (see store/progress): where you'd got to, the score, and a
// way back in. Carrying on takes you both back to exactly where you were.
export function ContinueCard({ onResume }: { onResume: (saved: Saved) => void }) {
  const [saved, setSaved] = useState(loadSaved)
  if (!saved) return null
  const s = saved.state
  const info = headerInfo(s)
  const name = SESSION_NAMES[saved.game] ?? GAME_LABELS[saved.game as GameKey]
  const where = info.title && info.title !== name ? `${info.title}${info.sub ? ` · ${info.sub}` : ''}` : info.sub
  const t = standing(s)
  const me = saved.seat
  const them = other(me)
  return (
    <section className="rounded-[1.75rem] border-2 border-fg bg-card p-4 flex flex-col gap-3 shadow-[4px_4px_0_rgba(0,0,0,0.12)] animate-fade-up">
      <div className="flex items-center gap-3">
        {info.icon && <GameIcon game={info.icon} size="sm" />}
        <div className="flex-1 min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.2em] font-extrabold text-accent-ink">Carry on where you left off</div>
          <div className="font-display text-xl font-extrabold leading-tight truncate">{name}</div>
          {where && <div className="text-xs font-bold text-fg/60 truncate">{where}</div>}
          <div className="text-xs font-bold text-fg/45 truncate">
            You {t[me]} · {s.players[them].name || 'them'} {t[them]} · saved {ago(Date.now() - saved.savedAt)}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { clearSaved(); setSaved(null) }}
          className="min-h-[48px] px-4 rounded-2xl border-2 border-fg/20 font-display font-extrabold text-fg/60 active:translate-y-px"
        >
          Forget it
        </button>
        <button
          onClick={() => onResume(saved)}
          className="flex-1 min-h-[48px] rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px"
        >
          Carry on
        </button>
      </div>
    </section>
  )
}
