import type { SessionState } from '../../engine/state'
import { drawAward } from '../../engine/standing'
import { DrawingCanvas } from '../../views/DrawingCanvas'
import { playerName } from '../../views/list'

export function ScreenDrawReveal({ s }: { s: SessionState }) {
  const d = s.draw!
  const round = d.rounds[d.current]
  const prompt = s.drawPrompts.find((p) => p.id === round.promptId)
  const award = drawAward(round)
  return (
    <div className="w-full max-w-md mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        It was
      </div>
      <div className="text-2xl sm:text-4xl font-bold uppercase tracking-tight break-words mb-4">
        {prompt?.text ?? '—'}
      </div>
      <DrawingCanvas strokes={round.strokes} />
      <div className="mt-6 sm:mt-8 flex items-baseline justify-between gap-4">
        <span className="text-base sm:text-2xl font-bold uppercase tracking-tight truncate">
          Guessed <span className="text-fg/60">"{round.guess || '—'}"</span>
        </span>
        <span className="text-base sm:text-2xl font-bold uppercase tracking-tight text-accent text-right shrink-0">
          {award ? `${playerName(s, award.player)} +${award.points}` : 'Nothing moves'}
        </span>
      </div>
    </div>
  )
}
