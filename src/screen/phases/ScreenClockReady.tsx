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
      {live.decider && (
        <div className="mb-2 font-display text-2xl sm:text-4xl font-extrabold text-pa-ink">Dead level! Closest takes the night</div>
      )}
      <div className="font-display text-4xl sm:text-6xl font-extrabold">Stop at {seconds(round.targetMs, 1)}</div>
      <div className="mt-1 sm:mt-3 text-base sm:text-xl text-fg/60">{hideHint(round.hideAfterMs)}</div>
      <div className="mt-8 sm:mt-12 flex justify-center">
        <span key={left} className="w-36 h-36 sm:w-52 sm:h-52 rounded-full bg-pa text-white border-2 border-fg shadow-[5px_5px_0_rgba(0,0,0,0.15)] inline-flex items-center justify-center font-display text-8xl sm:text-9xl font-extrabold animate-pop tabular-nums">
          <span className="translate-y-[0.06em]">{left}</span>
        </span>
      </div>
    </div>
  )
}
