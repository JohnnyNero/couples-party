import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { CHAIN } from '../../engine/phases'
import { dispatch } from '../../net'
import { Clock } from '../../screen/Clock'
import { ChainTrail } from '../../views/ChainTrail'
import { aLetter, rejectText } from '../../views/chain'
import { playerName } from '../../views/list'

// Your turn: one box, the letter you need, and the clock. A word that doesn't pass
// comes back with the reason and stays in the box to fix — the clock doesn't wait.
export function PlayChainTurn({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.chain!
  const round = g.rounds[g.current]
  const mine = round.turn === me
  const [word, setWord] = useState('')
  const send = () => {
    if (word.trim()) dispatch({ type: 'CHAIN_WORD', player: me, word })
  }
  const reject = round.reject && round.reject.player === round.turn ? round.reject : null

  return (
    <div className="h-full flex flex-col p-5 gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">Word Chain · round {round.index} of {g.rounds.length}</div>
          <div className="text-xl font-bold uppercase tracking-tight truncate">{round.category}</div>
        </div>
        <div className="font-display text-4xl font-bold tabular-nums shrink-0"><Clock phaseEndsAt={s.phaseEndsAt} /></div>
      </div>
      <div className="py-2"><ChainTrail round={round} max={5} /></div>
      {mine ? (
        <div className="flex flex-col gap-3">
          <div className="text-center text-lg uppercase tracking-wide">
            Your go · you need {aLetter(round.need)}
          </div>
          <input
            className="w-full min-h-[56px] text-2xl bg-ink text-paper px-4 outline-none border-b-4 border-accent rounded-t-xl"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            maxLength={CHAIN.maxLen}
            placeholder={`${round.need.toUpperCase()}…`}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="go"
          />
          <div className="h-5 text-sm font-bold text-accent text-center">
            {reject && rejectText(reject, round.need, round.category)}
          </div>
          <button
            className="w-full min-h-[52px] rounded-xl bg-accent text-bg text-lg font-bold uppercase tracking-widest active:translate-y-px"
            onClick={send}
          >
            Go
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-lg uppercase tracking-wide text-fg/60">
            {playerName(s, round.turn)} needs {aLetter(round.need)}
          </div>
          {reject && <div className="mt-2 text-sm text-fg/45">{rejectText(reject, round.need, round.category)}</div>}
        </div>
      )}
    </div>
  )
}
