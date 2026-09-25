import { aboutPartner } from '../../views/voice'
import { useMyPlayerId } from '../../net'
import type { SessionState } from '../../engine/state'
import { PromptCard, WhoIsIn } from '../../ui/kit'

export function ScreenFingerRound({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const f = s.finger!
  const round = f.rounds[f.current]
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">
      <PromptCard over="Put a finger down if…">{aboutPartner(s, round.statementId, me)}</PromptCard>
      <WhoIsIn s={s} done={{ A: round.applies.A !== null, B: round.applies.B !== null }} big />
    </div>
  )
}
