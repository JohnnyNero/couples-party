import { useEffect, useRef, useState } from 'react'
import type { Action, PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { FOLLOW, FRENZY, SPOT } from '../../engine/phases'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { buzz } from '../../ui/haptics'

// The three quick fillers' phone screens. Like Stop the Clock, each phone times itself
// from the moment its own screen appears and sends only the result — so however late a
// round reaches one of you, lag never decides it. Pointer-down, not click, so a tap
// counts when the finger lands.

// Keep sending a result until the game has it (only the first to arrive counts).
function useResend(action: Action | null, confirmed: boolean) {
  useEffect(() => {
    if (!action || confirmed) return
    const id = setInterval(() => dispatch(action, { quiet: true }), 1200)
    return () => clearInterval(id)
  }, [action, confirmed])
}

function Waiting({ s, me, label }: { s: SessionState; me: PlayerId; label?: string }) {
  return (
    <div className="text-center">
      {label && <div className="font-display text-3xl font-extrabold">{label}</div>}
      <div className="mt-1 text-sm font-bold text-fg/55">Waiting for {playerName(s, other(me))}</div>
    </div>
  )
}

// ---------------------------------------------------------------- Spot It

export function PlaySpot({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.spot!
  const round = g.rounds[g.current]
  const startedAt = useRef(performance.now())
  const [sent, setSent] = useState<Action | null>(null)
  const [locked, setLocked] = useState(false)
  const [miss, setMiss] = useState<number | null>(null)
  const done = sent !== null || round.found[me] !== null
  useResend(sent, round.found[me] !== null)

  const tap = (i: number) => {
    if (done || locked) return
    if (i !== round.at) {
      buzz('tap')
      setMiss(i)
      setLocked(true)
      setTimeout(() => { setLocked(false); setMiss(null) }, SPOT.lockoutMs)
      return
    }
    const action: Action = { type: 'SPOT_FOUND', player: me, ms: performance.now() - startedAt.current }
    setSent(action)
    dispatch(action)
  }

  return (
    <div className="h-full flex flex-col px-4 pb-5 gap-3 select-none">
      <div className="text-center font-display text-2xl font-extrabold">
        {done ? 'Found it!' : locked ? <span className="text-pa-ink">Not that one…</span> : 'Spot the odd one out'}
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          className={'grid gap-1 w-full aspect-square max-w-md ' + (locked ? 'opacity-50 animate-wiggle' : '')}
          style={{ gridTemplateColumns: `repeat(${round.size}, minmax(0, 1fr))`, maxHeight: '100%', width: 'min(100%, 60dvh)' }}
        >
          {Array.from({ length: round.size * round.size }, (_, i) => (
            <button
              key={i}
              onPointerDown={() => tap(i)}
              disabled={done}
              className={
                'aspect-square rounded-lg inline-flex items-center justify-center leading-none touch-none ' +
                (done && i === round.at ? 'bg-sage-soft ring-2 ring-sage-ink ' : miss === i ? 'bg-pa/25 ' : 'bg-fg/[0.04] ')
              }
              style={{ fontSize: `min(${Math.round(64 / round.size) / 10}rem, ${Math.round(46 / round.size)}dvh)` }}
              data-cell={i}
              aria-label={`Cell ${i + 1}`}
            >
              {i === round.at ? round.odd : round.base}
            </button>
          ))}
        </div>
      </div>
      {done && <Waiting s={s} me={me} />}
    </div>
  )
}

// ---------------------------------------------------------------- Frenzy

export function PlayFrenzy({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.frenzy!
  const round = g.rounds[g.current]
  const startedAt = useRef(performance.now())
  const count = useRef(0)
  const [taps, setTaps] = useState(0)
  const [left, setLeft] = useState(FRENZY.runMs)
  const [sent, setSent] = useState<Action | null>(null)
  const done = sent !== null || round.taps[me] !== null
  useResend(sent, round.taps[me] !== null)

  useEffect(() => {
    if (done) return
    let raf = 0
    const tick = () => {
      const t = FRENZY.runMs - (performance.now() - startedAt.current)
      if (t <= 0) {
        const action: Action = { type: 'FRENZY_TAPS', player: me, taps: count.current }
        setLeft(0)
        setSent(action)
        dispatch(action)
        return
      }
      setLeft(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [done, me])

  const tap = () => {
    if (done || left <= 0) return
    count.current += 1
    setTaps(count.current)
    if (count.current % 5 === 0) buzz('tap')
  }

  return (
    <div className="h-full flex flex-col px-5 pb-6 gap-3 select-none">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-6xl font-extrabold tabular-nums">{taps}</span>
        <span className="font-display text-3xl font-extrabold tabular-nums text-fg/50">{(left / 1000).toFixed(1)}s</span>
      </div>
      <button
        onPointerDown={tap}
        disabled={done}
        className={'flex-1 min-h-[12rem] rounded-[2rem] border-2 border-fg font-display text-6xl font-extrabold active:scale-[0.97] transition-transform duration-75 disabled:opacity-40 touch-none shadow-[5px_5px_0_rgba(0,0,0,0.15)] ' + (me === 'A' ? 'bg-pa text-white' : 'bg-pb text-white')}
      >
        {done ? 'Time!' : 'TAP'}
      </button>
      {done && <Waiting s={s} me={me} label={`${taps} taps`} />}
    </div>
  )
}

// ---------------------------------------------------------------- Follow Me

const PADS = ['bg-pa', 'bg-pb', 'bg-sage-ink', 'bg-tan-ink'] as const

// Both parts of a round: watching the pattern play (FOLLOW_SHOW), then playing it back
// (FOLLOW_PLAY). The pattern runs on this phone's own clock from when it appears.
export function PlayFollow({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.follow!
  const round = g.rounds[g.current]
  const steps = g.sequence.slice(0, round.length)
  return s.phase === 'FOLLOW_SHOW'
    ? <FollowShow key={`show${round.index}`} steps={steps} round={round.index} />
    : <FollowPlay key={`play${round.index}`} s={s} me={me} steps={steps} />
}

function Pads({ lit, onTap, disabled = false }: { lit: number | null; onTap?: (i: number) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto aspect-square" style={{ width: 'min(100%, 55dvh)' }}>
      {PADS.map((colour, i) => (
        <button
          key={i}
          onPointerDown={() => onTap?.(i)}
          disabled={disabled || !onTap}
          className={
            'rounded-[1.75rem] border-2 border-fg touch-none transition-[transform,opacity,filter] duration-100 ' + colour + ' ' +
            (lit === i ? 'opacity-100 scale-[1.04] brightness-125 shadow-[0_0_0_6px_rgba(255,255,255,0.6)]' : 'opacity-45 ')
          }
          aria-label={`Pad ${i + 1}`}
        />
      ))}
    </div>
  )
}

function FollowShow({ steps, round }: { steps: number[]; round: number }) {
  const [lit, setLit] = useState<number | null>(null)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    steps.forEach((pad, i) => {
      const on = FOLLOW.showLeadMs + i * FOLLOW.stepMs
      timers.push(setTimeout(() => setLit(pad), on))
      timers.push(setTimeout(() => setLit(null), on + FOLLOW.stepMs * 0.7))
    })
    return () => timers.forEach(clearTimeout)
  }, [steps])
  return (
    <div className="h-full flex flex-col px-5 pb-6 gap-4 select-none">
      <div className="text-center">
        <div className="font-display text-3xl font-extrabold">Watch…</div>
        <div className="text-sm font-bold text-fg/55">Round {round} · {steps.length} steps</div>
      </div>
      <div className="flex-1 min-h-0 flex items-center"><Pads lit={lit} /></div>
    </div>
  )
}

function FollowPlay({ s, me, steps }: { s: SessionState; me: PlayerId; steps: number[] }) {
  const round = s.follow!.rounds[s.follow!.current]
  const startedAt = useRef(performance.now())
  const [at, setAt] = useState(0)
  const [lit, setLit] = useState<number | null>(null)
  const [sent, setSent] = useState<Action | null>(null)
  const [slipped, setSlipped] = useState(false)
  const done = sent !== null || round.result[me] !== null
  useResend(sent, round.result[me] !== null)

  const finish = (got: number) => {
    const action: Action = { type: 'FOLLOW_DONE', player: me, got, ms: performance.now() - startedAt.current }
    setSent(action)
    dispatch(action)
  }
  const tap = (pad: number) => {
    if (done) return
    setLit(pad)
    setTimeout(() => setLit((l) => (l === pad ? null : l)), 180)
    if (pad !== steps[at]) {
      buzz('lock')
      setSlipped(true)
      finish(at)
      return
    }
    buzz('tap')
    if (at + 1 >= steps.length) finish(steps.length)
    else setAt(at + 1)
  }

  return (
    <div className="h-full flex flex-col px-5 pb-6 gap-4 select-none">
      <div className="text-center">
        <div className="font-display text-3xl font-extrabold">
          {slipped ? <span className="text-pa-ink">Slipped!</span> : done ? 'Got it all ✓' : 'Your turn'}
        </div>
        <div className="text-sm font-bold text-fg/55 tabular-nums">{done && !slipped ? steps.length : at} of {steps.length}</div>
      </div>
      <div className="flex-1 min-h-0 flex items-center"><Pads lit={lit} onTap={tap} disabled={done} /></div>
      {done && <Waiting s={s} me={me} />}
    </div>
  )
}
