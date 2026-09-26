import { useEffect, useRef, useState } from 'react'
import type { GameKey, SessionState } from '../engine/state'
import { GAME_LABELS, gameOfPhase } from '../engine/roster'
import { standing, teamScore } from '../engine/standing'
import { GameIcon } from '../ui/GameIcon'
import { Avatar, inkOf } from '../ui/Avatar'
import { Crown } from '../ui/fx'
import { AnimatedNumber } from './AnimatedNumber'
import { playerName } from './list'
import { railText } from './board'
import { PauseButton, PauseMenu } from './PauseMenu'
import { canPause } from '../engine/reducer'
import { dispatch, useMyPlayerId } from '../net'
import { useBackLayer } from '../ui/back'

const SESSION_NAMES: Record<string, string> = { tonight: 'Tonight', full: 'The full session' }

// What the header says: which game, and where in it you are.
export function headerInfo(s: SessionState): { icon: GameKey | null; title: string; sub: string } {
  if (s.phase === 'JOIN' || s.phase === 'BOOT') {
    return { icon: null, title: SESSION_NAMES[s.game] ?? GAME_LABELS[s.game as GameKey] ?? 'Coupled', sub: 'Getting ready' }
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
  // Back never drops you out of a game: mid-game it pauses (the same as the button),
  // and with the menu up it resumes. Leaving is the menu's own button.
  const me = useMyPlayerId()
  const menuUp = !!s.paused || menu
  useBackLayer(!big && !menuUp, () => {
    if (me && canPause(s)) dispatch({ type: 'PAUSE', player: me })
    else setMenu(true)
  })
  useBackLayer(!big && menuUp, () => {
    if (s.paused && me) dispatch({ type: 'RESUME', player: me })
    else setMenu(false)
  })
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

// The header's scores hold back while a reveal plays, then tick up — a bump, and the
// points dropping off them — so the header never gives a verdict away before the board
// has shown it. A new leader gets the crown with a hop.
const HOLD_MS = 2500 // past the slowest verdict (Two Lies, after both lies are crossed off)

type Held = { value: number; gain: number; at: number }

function useHeld(value: number): Held {
  const [held, setHeld] = useState<Held>({ value, gain: 0, at: 0 })
  const latest = useRef(held)
  latest.current = held
  useEffect(() => {
    if (value === latest.current.value) return
    const id = setTimeout(() => {
      const gain = value - latest.current.value
      setHeld({ value, gain: gain > 0 ? gain : 0, at: Date.now() })
    }, HOLD_MS)
    return () => clearTimeout(id)
  }, [value])
  return held
}

function HeldNumber({ held, className = '' }: { held: Held; className?: string }) {
  // Keyed on the change, so the bump replays each time — and the count restarts from
  // where it was.
  return (
    <span className={'relative inline-block ' + className}>
      <span key={held.at} className={'inline-block ' + (held.gain ? 'animate-bump' : '')}>
        <AnimatedNumber value={held.value} from={held.value - held.gain} durationMs={500} />
      </span>
      {held.gain > 0 && (
        <span key={`g${held.at}`} className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 z-20" aria-hidden="true">
          <span className="block font-display text-sm font-extrabold animate-float-down">+{held.gain}</span>
        </span>
      )}
    </span>
  )
}

export function ScorePill({ s, big = false }: { s: SessionState; big?: boolean }) {
  const t = standing(s)
  const a = useHeld(t.A)
  const b = useHeld(t.B)
  const together = useHeld(teamScore(s))
  const lead = a.value === b.value ? null : a.value > b.value ? 'A' : 'B'
  const avatar = (p: 'A' | 'B') => (
    <span className="relative inline-flex">
      <Avatar p={p} name={playerName(s, p)} size={big ? 'md' : 'sm'} />
      {lead === p && (
        <span key={lead} className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <span className="block animate-crown-hop"><Crown className={big ? 'w-5 h-4' : 'w-3.5 h-2.5'} /></span>
        </span>
      )}
    </span>
  )
  return (
    <div
      className={'shrink-0 flex items-center gap-1.5 rounded-full border-2 border-fg/10 bg-card pl-1 pr-1 py-1 ' + (big ? 'text-2xl' : 'text-[0.95rem]')}
      aria-label={`${playerName(s, 'A')} ${t.A}, ${playerName(s, 'B')} ${t.B}`}
    >
      {avatar('A')}
      <HeldNumber held={a} className={'font-display font-extrabold tabular-nums ' + inkOf('A')} />
      <span className="text-fg/25">·</span>
      <HeldNumber held={b} className={'font-display font-extrabold tabular-nums ' + inkOf('B')} />
      {avatar('B')}
      {/* Yours together. */}
      <span className={'ml-0.5 rounded-full bg-tan-soft text-tan-ink font-display font-extrabold tabular-nums ' + (big ? 'px-3 py-0.5' : 'px-2 py-0.5 text-[0.85rem]')} aria-label={`Together ${teamScore(s)}`}>
        <HeldNumber held={together} />
      </span>
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
