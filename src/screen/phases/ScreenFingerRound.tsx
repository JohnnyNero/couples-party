import type { SessionState } from '../../engine/state'
import { PromptCard, WhoIsIn } from '../../ui/kit'

export function ScreenFingerRound({ s }: { s: SessionState }) {
  const f = s.finger!
  const round = f.rounds[f.current]
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">
      <PromptCard over="Put a finger down if…">{round.statementId}</PromptCard>
      <WhoIsIn s={s} done={{ A: round.applies.A !== null, B: round.applies.B !== null }} big />
    </div>
  )
}
