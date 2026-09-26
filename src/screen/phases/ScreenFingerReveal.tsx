import { aboutPartner } from '../../views/voice'
import { useMyPlayerId } from '../../net'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { calledRight, fingerRoundPoints, shown } from '../../engine/standing'
import { Avatar, inkOf } from '../../ui/Avatar'
import { eyebrow } from '../../ui/styles'
import { playerName } from '../../views/list'
import { Burst, at, verdictFx } from '../../ui/fx'
import { capital } from './ScreenFingerRound'

// The truth from each of you, turned over one at a time, and whether the other called
// it.
export function ScreenFingerReveal({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const f = s.finger!
  const round = f.rounds[f.current]
  const both = calledRight(round, 'A') && calledRight(round, 'B')
  return (
    <div className="w-full max-w-2xl mx-auto text-center flex flex-col gap-6">
      <div>
        <div className={eyebrow}>Called it?</div>
        <div className="mt-2 font-display text-2xl sm:text-4xl font-extrabold leading-tight break-words">{capital(aboutPartner(s, round.statementId, me))}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {(['A', 'B'] as PlayerId[]).map((p, i) => {
          const caller = other(p)
          const truth = round.answer[p]
          const right = calledRight(round, caller)
          const pts = shown(s, 'finger', fingerRoundPoints(round, caller))
          return (
            <div key={p} className="relative rounded-3xl border-2 border-fg bg-card px-3 py-4 flex flex-col items-center gap-1.5">
              <Avatar p={p} name={playerName(s, p)} />
              <div style={at(200 + i * 700)} className={'font-display text-3xl font-extrabold animate-flip-in ' + inkOf(p)}>{truth === null ? '—' : truth ? 'True' : 'Not me'}</div>
              <div className="text-xs font-bold text-fg/55">
                {playerName(s, caller)} called {round.predict[caller] === null ? 'nothing' : round.predict[caller] ? '“true”' : '“not them”'}
              </div>
              <div style={at(650 + i * 700)} className={'h-7 font-display text-xl font-extrabold ' + verdictFx(right) + (right ? ' text-sage-ink' : ' text-fg/35')}>
                {right ? `Called it · +${pts}` : 'Missed'}
              </div>
              {right && <Burst delay={700 + i * 700} count={12} spread={0.7} />}
            </div>
          )
        })}
      </div>
      {both && <div style={at(2100)} className="font-display text-xl font-extrabold text-tan-ink animate-slam">You both called it 🤝</div>}
    </div>
  )
}
