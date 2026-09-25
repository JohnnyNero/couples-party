import { useEffect, useRef, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { dispatch } from '../../net'
import { liveClock, seconds } from '../../views/fillers'
import { playerName } from '../../views/list'

// The clock starts the moment this screen appears on THIS phone, and the phone sends
// only how long it ran before the tap — so however late the round reached this phone,
// the time it reports is its own and fair. Pointer-down, not click: a click fires on
// release, which would add a finger's worth of lag to every tap.
export function PlayClockRun({ s, me }: { s: SessionState; me: PlayerId }) {
  const live = liveClock(s)!
  const round = live.game.rounds[live.game.current]
  const startedAt = useRef(performance.now())
  const [elapsed, setElapsed] = useState(0)
  const [tapped, setTapped] = useState(false)
  const done = tapped || round.stopped[me] !== null

  useEffect(() => {
    if (done) return
    let raf = 0
    const tick = () => {
      setElapsed(performance.now() - startedAt.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [done])

  const stop = () => {
    if (done) return
    const ms = performance.now() - startedAt.current
    setTapped(true)
    dispatch({ type: 'STOP_CLOCK', player: me, elapsedMs: ms })
  }

  const visible = elapsed < round.hideAfterMs
  return (
    <div className="h-full flex flex-col p-5 gap-4 select-none">
      <div className="text-center">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">
          {live.decider ? 'Tiebreaker · closest takes the night' : `Stop the Clock · round ${round.index}`}
        </div>
        <div className="text-2xl font-bold uppercase tracking-tight">Stop at {seconds(round.targetMs, 1)}</div>
      </div>
      <div className="text-center font-display text-6xl font-bold tabular-nums">
        {done ? <span className="text-fg/40 text-3xl uppercase tracking-widest">Locked in</span>
          : visible ? (elapsed / 1000).toFixed(2) : <span className="text-fg/25">?.??</span>}
      </div>
      <button
        onPointerDown={stop}
        disabled={done}
        className="flex-1 min-h-[10rem] rounded-3xl bg-accent text-bg text-5xl font-bold uppercase tracking-widest active:scale-[0.98] disabled:opacity-30 touch-none"
      >
        Stop
      </button>
      {done && (
        <div className="text-center text-sm uppercase tracking-wide text-fg/50">
          Waiting for {playerName(s, other(me))}
        </div>
      )}
    </div>
  )
}
