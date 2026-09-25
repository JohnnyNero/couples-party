import { aboutPartner } from '../../views/voice'
import { useMyPlayerId } from '../../net'
import type { PlayerId, SessionState } from '../../engine/state'
import { fingerRoundPoints } from '../../engine/standing'
import { Avatar, inkOf } from '../../ui/Avatar'
import { Hand } from '../../ui/kit'
import { eyebrow } from '../../ui/styles'
import { playerName } from '../../views/list'

export function ScreenFingerReveal({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const f = s.finger!
  const round = f.rounds[f.current]
  return (
    <div className="w-full max-w-2xl mx-auto text-center flex flex-col gap-7">
      <div>
        <div className={eyebrow}>Put a finger down if…</div>
        <div className="mt-2 font-display text-2xl sm:text-4xl font-extrabold leading-tight break-words">{aboutPartner(s, round.statementId, me)}</div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B'] as PlayerId[]).map((p) => {
          const down = round.applies[p]
          const pts = fingerRoundPoints(round, p)
          return (
            <div key={p} className={'rounded-3xl border-2 px-3 py-5 flex flex-col items-center gap-2 ' + (down ? 'border-fg/15' : 'border-fg bg-card')}>
              <Avatar p={p} name={playerName(s, p)} />
              <div className="font-display text-xl sm:text-3xl font-extrabold">{down ? 'Finger down' : 'Kept it up'}</div>
              <Hand fingers={f.fingersLeft[p]} p={p} />
              <div className={'h-7 font-display text-2xl font-extrabold animate-pop ' + inkOf(p)}>{pts > 0 ? `+${pts}` : ''}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
