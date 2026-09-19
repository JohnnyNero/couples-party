import { useSession } from '../net/playroom'
import { Clock } from './Clock'
import { ScreenJoin } from './phases/ScreenJoin'
import { ScreenMeldType } from './phases/ScreenMeldType'
import { ScreenMeldReveal } from './phases/ScreenMeldReveal'
import { ScreenMeldResult } from './phases/ScreenMeldResult'

export function Screen() {
  const s = useSession()
  const railText =
    s.phase.startsWith('MELD') && s.meld
      ? `ACT I · MIND MELD · ROUND ${s.meld.rounds.length} OF 7`
      : s.phase === 'JOIN' ? 'JOIN' : s.phase
  return (
    <div className="h-full w-full font-board flex flex-col p-6 select-none">
      <div className="text-xl tracking-widest border-b border-fg/30 pb-3">{railText}</div>
      <div className="flex-1 flex items-center justify-center">
        {s.phase === 'JOIN' && <ScreenJoin s={s} />}
        {s.phase === 'MELD_TYPE' && <ScreenMeldType s={s} />}
        {s.phase === 'MELD_REVEAL' && <ScreenMeldReveal s={s} />}
        {(s.phase === 'MELD_RESULT' || s.phase === 'DONE') && <ScreenMeldResult s={s} />}
      </div>
      <div className="flex justify-between items-end border-t border-fg/30 pt-3">
        <div className="text-xl tracking-widest">POT 0</div>
        <Clock phaseEndsAt={s.phaseEndsAt} />
      </div>
    </div>
  )
}
