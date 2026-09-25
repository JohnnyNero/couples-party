import type { SessionState } from '../../engine/state'
import { PromptCard, WhoIsIn } from '../../ui/kit'

export function ScreenMmAnswer({ s }: { s: SessionState }) {
  const g = s.mrmrs!
  const round = g.rounds[g.current]
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">
      <PromptCard over="Your answer, and your guess at theirs">{round.question}</PromptCard>
      <WhoIsIn s={s} done={{ A: round.answer.A !== null, B: round.answer.B !== null }} big />
    </div>
  )
}
