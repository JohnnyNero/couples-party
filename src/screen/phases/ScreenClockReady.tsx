import { useEffect, useState } from 'react'
import type { SessionState } from '../../engine/state'
import { hideHint, liveClock, seconds } from '../../views/fillers'

// The target, then 3-2-1. The countdown runs on this screen's own clock from the moment
// it appears — it's only there to get you ready; each phone times its own run.
export function ScreenClockReady({ s }: { s: SessionState }) {
  const live = liveClock(s)!
  const round = live.game.rounds[live.game.current]
  const [left, setLeft] = useState(3)
  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setLeft(Math.max(1, 3 - Math.floor((Date.now() - t0) / 1000))), 100)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        {live.decider ? 'Dead level · closest takes the night' : `Stop the Clock · round ${round.index}`}
      </div>
      <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight">Stop at {seconds(round.targetMs, 1)}</div>
      <div className="mt-2 sm:mt-4 text-sm sm:text-xl text-fg/60">{hideHint(round.hideAfterMs)}</div>
      <div key={left} className="mt-6 sm:mt-10 font-display text-7xl sm:text-9xl font-bold text-accent animate-pop tabular-nums">
        {left}
      </div>
    </div>
  )
}
