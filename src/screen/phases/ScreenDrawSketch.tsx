import type { SessionState } from '../../engine/state'
import { pairOf } from '../../engine/reducer'
import { playerName } from '../../views/list'
import { drawQuestion } from '../../views/draw'
import { Avatar } from '../../ui/Avatar'
import { WhoIsIn } from '../../ui/kit'
import { eyebrow } from '../../ui/styles'
import { CANVAS_ASPECT, PAPER } from '../../views/DrawingCanvas'

// You're both drawing at once. The board shows each question — it's about the drawer,
// and knowing it is half the guess — but never an answer or a drawing in progress.
export function ScreenDrawSketch({ s }: { s: SessionState }) {
  const pair = pairOf(s.draw!)
  const done = { A: false, B: false }
  for (const r of pair) done[r.drawer] = r.answer !== null
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {pair.map((r) => (
          <div key={r.index} className="flex flex-col gap-2">
            <div className={eyebrow + ' truncate'}>{drawQuestion(s, r, null)}</div>
            <div className={`w-full ${CANVAS_ASPECT} ${PAPER} !border-dashed !border-fg/25 !shadow-none flex flex-col items-center justify-center gap-2`}>
              <Avatar p={r.drawer} name={playerName(s, r.drawer)} size="md" className={done[r.drawer] ? '' : 'animate-pulse'} />
              <span className="font-bold text-fg/55 text-sm">{done[r.drawer] ? 'Done' : 'Drawing…'}</span>
            </div>
          </div>
        ))}
      </div>
      <WhoIsIn s={s} done={done} waiting={() => 'Drawing…'} big />
    </div>
  )
}
