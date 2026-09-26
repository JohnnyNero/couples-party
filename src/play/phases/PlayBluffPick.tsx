import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { bluffOptions, bluffPrompt } from '../../views/bluff'
import { Avatar, inkOf } from '../../ui/Avatar'
import { eyebrow } from '../../ui/styles'

// One of you's three, shuffled. The other taps the one they think is true; the one
// they belong to watches (with their truth marked, so they can keep a straight face).
export function PlayBluffPick({ s, me }: { s: SessionState; me: PlayerId }) {
  const round = s.bluff!.rounds[s.bluff!.current]
  const owner = round.turn
  const mine = owner === me
  const options = bluffOptions(round, owner)
  return (
    <div className="h-full flex flex-col px-5 pb-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center gap-3 py-4">
        <div className="flex items-center gap-2">
          <Avatar p={owner} name={playerName(s, owner)} size="sm" />
          <span className={eyebrow}>{mine ? `${playerName(s, other(me))} is picking` : 'Which one’s true?'}</span>
        </div>
        <div className="font-display text-[1.75rem] font-extrabold leading-[1.1] tracking-tight break-words">{bluffPrompt(s, round, owner, me)}</div>
        <div className="flex flex-col gap-2.5 mt-2">
          {options.map((o) =>
            mine ? (
              <div key={o.id} className={'rounded-2xl border-2 px-4 py-3.5 font-display text-lg font-extrabold leading-tight break-words ' + (o.id === 0 ? 'border-sage-ink bg-sage-soft' : 'border-fg/15 text-fg/60')}>
                {o.text}
                <div className={'text-xs font-bold mt-0.5 ' + (o.id === 0 ? 'text-sage-ink' : 'text-fg/40')}>{o.id === 0 ? 'Your truth' : 'Your lie'}</div>
              </div>
            ) : (
              <button
                key={o.id}
                onClick={() => dispatch({ type: 'PICK_BLUFF', player: me, choice: o.id })}
                className={'text-left rounded-2xl border-2 border-fg bg-card px-4 py-4 font-display text-xl font-extrabold leading-tight break-words active:translate-y-px shadow-[3px_3px_0_rgba(0,0,0,0.12)] ' + inkOf(owner)}
              >
                {o.text}
              </button>
            ),
          )}
        </div>
        {mine && <div className="text-sm text-fg/55 text-center mt-2">Poker face.</div>}
      </div>
    </div>
  )
}
