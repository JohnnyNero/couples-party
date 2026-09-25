import { useEffect, useRef, useState } from 'react'
import type { GameKey, SessionState } from '../engine/state'
import { GAME_LABELS, gameOfPhase } from '../engine/roster'
import { standing } from '../engine/standing'
import { GameIcon } from '../ui/GameIcon'
import { Avatar } from '../ui/Avatar'
import { playerName } from './list'
import { railText } from './board'
import { PauseButton, PauseMenu } from './PauseMenu'

const SESSION_NAMES: Record<string, string> = { tonight: 'Tonight', full: 'The full session' }

// What the header says: which game, and where in it you are.
export function headerInfo(s: SessionState): { icon: GameKey | null; title: string; sub: string } {
  if (s.phase === 'JOIN' || s.phase === 'BOOT') {
    return { icon: null, title: SESSION_NAMES[s.game] ?? GAME_LABELS[s.game as GameKey] ?? 'Couples Party', sub: 'Getting ready' }
  }
  if (s.phase === 'DONE') return { icon: 'lights', title: "That's the night", sub: '' }
  if (s.phase === 'LIGHTS_OUT') return { icon: 'lights', title: 'Lights out', sub: '' }
  if (s.phase === 'INTRO' && s.intro) return { icon: s.intro.key, title: GAME_LABELS[s.intro.key], sub: 'How to play' }
  if (s.phase.startsWith('DECIDER_')) return { icon: 'clock', title: 'Tiebreaker', sub: 'Sudden death' }
  const key = gameOfPhase(s.phase)
  if (!key) return { icon: null, title: railText(s), sub: '' }
  const label = GAME_LABELS[key]
  const rail = railText(s)
  return { icon: key, title: label, sub: rail.startsWith(`${label} · `) ? rail.slice(label.length + 3) : '' }
}

// The strip across the top of every game screen: the game, the round, both scores, and
// the clock as a bar that runs down.
export function GameHeader({ s, big = false }: { s: SessionState; big?: boolean }) {
  const { icon, title, sub } = headerInfo(s)
  const [menu, setMenu] = useState(false)
  return (
    <div className={'shrink-0 flex flex-col gap-2.5 ' + (big ? 'px-8 pt-6 pb-3' : 'px-5 pt-4 pb-2')}>
      <div className="flex items-center gap-2.5">
        {icon && <GameIcon game={icon} size={big ? 'lg' : 'sm'} />}
        <div className="flex-1 min-w-0">
          <div className={'font-display font-bold leading-none truncate ' + (big ? 'text-3xl' : 'text-base')}>{title}</div>
          {sub && <div className={'font-bold text-fg/55 truncate ' + (big ? 'text-lg mt-1' : 'text-xs mt-0.5')}>{sub}</div>}
        </div>
        {s.phase !== 'JOIN' && <ScorePill s={s} big={big} />}
        <PauseButton s={s} onOpenLocal={() => setMenu(true)} />
      </div>
      <TimerBar phaseEndsAt={s.phaseEndsAt} paused={!!s.paused} />
      <PauseMenu s={s} localOpen={menu} onCloseLocal={() => setMenu(false)} />
    </div>
  )
}

export function ScorePill({ s, big = false }: { s: SessionState; big?: boolean }) {
  const t = standing(s)
  return (
    <div
      className={'shrink-0 flex items-center gap-1.5 rounded-full border-2 border-fg/10 bg-card pl-1 pr-1 py-1 ' + (big ? 'text-2xl' : 'text-[0.95rem]')}
      aria-label={`${playerName(s, 'A')} ${t.A}, ${playerName(s, 'B')} ${t.B}`}
    >
      <Avatar p="A" name={playerName(s, 'A')} size={big ? 'md' : 'sm'} />
      <span className="font-display font-extrabold tabular-nums">{t.A}</span>
      <span className="text-fg/25">·</span>
      <span className="font-display font-extrabold tabular-nums">{t.B}</span>
      <Avatar p="B" name={playerName(s, 'B')} size={big ? 'md' : 'sm'} />
    </div>
  )
}

// The phase's clock as a bar. It only knows the deadline, so it measures the whole from
// the moment a new deadline arrives, and runs down from there. The last five seconds go
// coral. Holds its space even when there's no clock, so nothing jumps.
// Paused, it holds where it was; on resume it carries on from there rather than
// starting a fresh bar for what's left.
export function TimerBar({ phaseEndsAt, paused = false }: { phaseEndsAt: number | null; paused?: boolean }) {
  const [left, setLeft] = useState(1)
  const [secs, setSecs] = useState<number | null>(null)
  const total = useRef(1)
  const held = useRef(false)
  useEffect(() => {
    if (phaseEndsAt == null) {
      if (paused) held.current = true
      else setSecs(null)
      return
    }
    if (!held.current) total.current = Math.max(1, phaseEndsAt - Date.now())
    held.current = false
    let raf = 0
    const tick = () => {
      const ms = Math.max(0, phaseEndsAt - Date.now())
      setLeft(ms / total.current)
      setSecs(Math.ceil(ms / 1000))
      if (ms > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phaseEndsAt, paused])
  const low = secs !== null && secs <= 5
  return (
    <div className={'flex items-center gap-2 ' + (secs === null ? 'invisible' : '')} aria-hidden={secs === null}>
      <div className="flex-1 h-1.5 rounded-full bg-fg/10 overflow-hidden">
        <div className={'h-full rounded-full ' + (low ? 'bg-pa' : 'bg-fg')} style={{ width: `${left * 100}%` }} />
      </div>
      <span className={'w-6 text-right text-xs font-extrabold tabular-nums ' + (low ? 'text-pa-ink' : 'text-fg/55')}>{secs ?? ''}</span>
    </div>
  )
}
