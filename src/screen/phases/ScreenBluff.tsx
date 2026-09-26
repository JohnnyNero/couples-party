import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { bluffAward, SCORING } from '../../engine/standing'
import { dispatch, useLive, useMyPlayerId } from '../../net'
import { asYou } from '../../say'
import { playerName } from '../../views/list'
import { bluffLiveKey, bluffOptions, bluffPrompt } from '../../views/bluff'
import { Avatar, inkOf } from '../../ui/Avatar'
import { Doing, PromptCard, WhoIsIn } from '../../ui/kit'
import { btnAccent, eyebrow } from '../../ui/styles'

// Writing: the prompt, and who's ready.
export function ScreenBluffWrite({ s }: { s: SessionState }) {
  const round = s.bluff!.rounds[s.bluff!.current]
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">
      <PromptCard over="The truth, and two lies">{asYou(round.prompt)}</PromptCard>
      <WhoIsIn s={s} done={{ A: round.entry.A !== null, B: round.entry.B !== null }} waiting={() => 'Writing…'} big />
    </div>
  )
}

// Picking, on the TV: the three, and who's deciding.
export function ScreenBluffPick({ s }: { s: SessionState }) {
  const round = s.bluff!.rounds[s.bluff!.current]
  const owner = round.turn
  const live = useLive(bluffLiveKey(s))
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className={eyebrow + ' text-center'}>Two lies and a truth</div>
      <div className="text-center font-display text-2xl sm:text-4xl font-extrabold leading-tight break-words">{bluffPrompt(s, round, owner, null)}</div>
      <div className="flex flex-col gap-2.5">
        {bluffOptions(round, owner).map((o, i) => (
          <div
            key={o.id}
            style={{ animationDelay: `${i * 150}ms` }}
            className={
              'rounded-2xl border-2 px-5 py-4 flex items-center gap-3 font-display text-xl sm:text-3xl font-extrabold leading-tight break-words animate-fade-up transition-colors ' +
              (live === o.id ? 'border-pb bg-pb-soft' : 'border-fg bg-card ' + inkOf(owner))
            }
          >
            <span className="flex-1 min-w-0">{o.text}</span>
            {live === o.id && <Avatar p={other(owner)} name={playerName(s, other(owner))} size="sm" className="shrink-0" />}
          </div>
        ))}
      </div>
      <Doing s={s} p={other(owner)} finished={false} busy={`${playerName(s, other(owner))} is picking…`} done="" big />
    </div>
  )
}

// The truth comes out: the three again, the true one lit up, the pick marked. No clock —
// the tap to move on is whenever you've finished saying "wait, really?".
export function ScreenBluffReveal({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const g = s.bluff!
  const round = g.rounds[g.current]
  const owner = round.turn
  const guesser = other(owner)
  const pick = round.pick[owner]
  const award = bluffAward(round, owner)
  const verdict = pick === 0
    ? `${playerName(s, guesser)} spotted it · +${SCORING.bluffSpotted}`
    : pick === -1
      ? `Out of time · ${playerName(s, owner)} +${SCORING.bluffFooled}`
      : `Fooled! · ${playerName(s, owner)} +${SCORING.bluffFooled}`
  const more = round.pick[guesser] === null && round.entry[guesser] !== null
  const next = more ? `Next: ${playerName(s, guesser)}’s three` : g.current < g.rounds.length - 1 ? 'Next round' : 'See the scores'
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div className="text-center font-display text-2xl sm:text-4xl font-extrabold leading-tight break-words">{bluffPrompt(s, round, owner, me)}</div>
      <div className="flex flex-col gap-2.5">
        {bluffOptions(round, owner).map((o) => {
          const truth = o.id === 0
          const picked = o.id === pick
          return (
            <div
              key={o.id}
              className={
                'rounded-2xl border-2 px-5 py-3.5 flex items-center gap-3 ' +
                (truth ? 'border-sage-ink bg-sage-soft animate-reveal-pop' : 'border-fg/15 bg-card')
              }
            >
              <div className="flex-1 min-w-0">
                <div className={'font-display text-xl sm:text-3xl font-extrabold leading-tight break-words ' + (truth ? 'text-fg' : 'text-fg/40 line-through decoration-2')}>
                  {o.text}
                </div>
                <div className={'text-xs sm:text-sm font-extrabold ' + (truth ? 'text-sage-ink' : 'text-fg/40')}>{truth ? 'The truth' : 'A lie'}</div>
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
      <div className={'text-center font-display text-2xl sm:text-3xl font-extrabold ' + (award ? inkOf(award.player) : '')}>{verdict}</div>
      {me !== null && s.phase === 'BLUFF_REVEAL' && (
        <button className={btnAccent} onClick={() => dispatch({ type: 'ADVANCE_REVEAL', player: me })}>
          {next}
        </button>
      )}
    </div>
  )
}
