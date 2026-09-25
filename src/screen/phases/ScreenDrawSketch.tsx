import type { SessionState } from '../../engine/state'
import { playerName } from '../../views/list'
import { drawQuestion } from '../../views/draw'
import { useMyPlayerId } from '../../net'
import { PromptCard } from '../../ui/kit'
import { Avatar } from '../../ui/Avatar'
import { CANVAS_ASPECT, PAPER } from '../../views/DrawingCanvas'

// The board shows the question — it's about the drawer, and knowing it is half the
// guess — but never their answer or the drawing in progress.
export function ScreenDrawSketch({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const d = s.draw!
  const round = d.rounds[d.current]
  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5">
      <PromptCard over={`${playerName(s, round.drawer)} is answering`}>{drawQuestion(s, round, me)}</PromptCard>
      <div className={`w-full ${CANVAS_ASPECT} ${PAPER} !border-dashed !border-fg/25 !shadow-none flex flex-col items-center justify-center gap-2`}>
        <Avatar p={round.drawer} name={playerName(s, round.drawer)} size="md" className="animate-pulse" />
        <span className="font-bold text-fg/55">Drawing…</span>
      </div>
    </div>
  )
}
