import { aboutPartner } from '../../views/voice'
import { useMyPlayerId } from '../../net'
import type { SessionState } from '../../engine/state'
import { PromptCard, WhoIsIn } from '../../ui/kit'

// Called It: the statement, and who's answered.
export function ScreenFingerRound({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const f = s.finger!
  const round = f.rounds[f.current]
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">
      <PromptCard over="True for you? And for them?">{capital(aboutPartner(s, round.statementId, me))}</PromptCard>
      <WhoIsIn s={s} done={{ A: round.answer.A !== null, B: round.answer.B !== null }} waiting={() => 'Calling it…'} big />
    </div>
  )
}

export const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
