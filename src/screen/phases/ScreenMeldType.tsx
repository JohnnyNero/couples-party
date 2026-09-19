import type { ReactNode } from 'react'
import type { SessionState } from '../../engine/state'
import { Dot } from '../../views/Dot'
import { shownPair } from '../../views/meld'

export function ScreenMeldType({ s }: { s: SessionState }) {
  const meld = s.meld!
  const round = meld.rounds[meld.rounds.length - 1]
  const [a, b] = shownPair(meld, round)
  return (
    <div className="w-full text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-6 sm:mb-10">
        Meet in the middle
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-10">
        <Word>{a}</Word>
        <span className="text-2xl sm:text-4xl text-fg/30">+</span>
        <Word>{b}</Word>
      </div>
      <div className="mt-8 sm:mt-14 flex items-center justify-center gap-4">
        <Dot on={round.words.A !== null} />
        <Dot on={round.words.B !== null} />
      </div>
    </div>
  )
}

function Word({ children }: { children: ReactNode }) {
  return <div className="text-4xl sm:text-6xl md:text-7xl font-bold uppercase tracking-tight">{children}</div>
}
