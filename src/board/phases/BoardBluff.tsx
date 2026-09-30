import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { bluffAward, SCORING, shown as scaled } from '../../engine/standing'
import { dispatch, useMyPlayerId } from '../../net'
import { playerName } from '../../views/list'
import { bluffOptions, bluffPrompt } from '../../views/bluff'
import { Avatar, inkOf } from '../../ui/Avatar'
import { btnAccent } from '../../ui/styles'
import { Burst, at, verdictFx } from '../../ui/fx'

// The truth comes out: the three again with the pick marked, then the lies crossed off
// one at a time until only the truth is left, lit up. No clock — the tap to move on is
// whenever you've finished saying "wait, really?".
const STRIKE_AT = 700
const STRIKE_GAP = 650
export function BoardBluffReveal({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const g = s.bluff!
  const round = g.rounds[g.current]
  const owner = round.turn
  const guesser = other(owner)
  const pick = round.pick[owner]
  const award = bluffAward(round, owner)
  const verdict = pick === 0
    ? `${playerName(s, guesser)} spotted it · +${scaled(s, 'bluff', SCORING.bluffSpotted)}`
    : pick === -1
      ? `Out of time · ${playerName(s, owner)} +${scaled(s, 'bluff', SCORING.bluffFooled)}`
      : `Fooled! · ${playerName(s, owner)} +${scaled(s, 'bluff', SCORING.bluffFooled)}`
  const more = round.pick[guesser] === null && round.entry[guesser] !== null
  const next = more ? `Next: ${playerName(s, guesser)}’s three` : g.current < g.rounds.length - 1 ? 'Next round' : 'See the scores'
  const options = bluffOptions(round, owner)
  const lies = options.filter((o) => o.id !== 0).map((o) => o.id)
  const truthAt = STRIKE_AT + lies.length * STRIKE_GAP
  const verdictAt = truthAt + 400
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center font-display text-2xl sm:text-4xl font-extrabold leading-tight break-words">{bluffPrompt(s, round, owner, me)}</div>
      <div className="flex flex-col gap-2.5">
        {options.map((o) => {
          const truth = o.id === 0
          const picked = o.id === pick
          const when = truth ? truthAt : STRIKE_AT + lies.indexOf(o.id) * STRIKE_GAP
          return (
            <div
              key={o.id}
              style={truth ? { animation: `light-sage 350ms ease-out ${when}ms both` } : undefined}
              className="rounded-2xl border-2 border-fg/15 bg-card px-5 py-3.5 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div
                  style={truth ? undefined : { animation: `strike 350ms ease-out ${when}ms both` }}
                  className={'font-display text-xl sm:text-3xl font-extrabold leading-tight break-words text-fg ' + (truth ? '' : 'line-through decoration-2')}
                >
                  {o.text}
                </div>
                <div style={at(when)} className={'text-xs sm:text-sm font-extrabold animate-fade-up ' + (truth ? 'text-sage-ink' : 'text-fg/40')}>{truth ? 'The truth' : 'A lie'}</div>
              </div>
              {picked && (
                <span className="shrink-0 flex flex-col items-center gap-0.5">
                  <Avatar p={guesser} name={playerName(s, guesser)} size="sm" />
                  <span className={'text-[0.65rem] font-extrabold ' + inkOf(guesser)}>picked</span>
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="relative text-center">
        <div style={at(verdictAt)} className={'font-display text-2xl sm:text-3xl font-extrabold ' + verdictFx(pick !== -1) + ' ' + (award ? inkOf(award.player) : '')}>{verdict}</div>
        {pick === 0 && <Burst delay={verdictAt + 100} />}
      </div>
      {me !== null && s.phase === 'BLUFF_REVEAL' && (
        <div style={at(verdictAt + 300)} className="animate-fade-up">
          <button className={btnAccent + ' w-full'} onClick={() => dispatch({ type: 'ADVANCE_REVEAL', player: me })}>
            {next}
          </button>
        </div>
      )}
    </div>
  )
}
