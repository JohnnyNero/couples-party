import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { CHAIN } from '../../engine/phases'
import { dispatch } from '../../net'
import { Clock } from '../../screen/Clock'
import { ChainTrail } from '../../views/ChainTrail'
import { aLetter, rejectText } from '../../views/chain'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { btnAccent, eyebrow, field } from '../../ui/styles'

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
    <div className="h-full flex flex-col px-5 pb-6 gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={eyebrow}>Category</div>
          <div className="font-display text-2xl font-extrabold leading-tight truncate">{round.category}</div>
        </div>
        <div className={'shrink-0 w-14 h-14 rounded-full border-2 border-fg bg-card inline-flex items-center justify-center font-display text-2xl ' + (mine ? '' : 'opacity-50')}>
          <Clock phaseEndsAt={s.phaseEndsAt} />
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"><ChainTrail round={round} max={5} /></div>
      {mine ? (
        <div className="flex flex-col gap-2.5">
          <div className="text-center font-display text-2xl font-extrabold">
            Your go · you need <span className={inkOf(me)}>{aLetter(round.need)}</span>
          </div>
          <input
            className={field + ' text-2xl'}
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
          <div className="h-5 text-sm font-bold text-pa-ink text-center">
            {reject && rejectText(reject, round.need, round.category)}
          </div>
          <button className={btnAccent} onClick={send}>
            Go
          </button>
        </div>
      ) : (
        <div className="pb-10 text-center">
          <div className="flex items-center justify-center gap-2 font-display text-2xl font-extrabold text-fg/70">
            <Avatar p={round.turn} name={playerName(s, round.turn)} size="md" className="animate-pulse" />
            {playerName(s, round.turn)} needs {aLetter(round.need)}
          </div>
          {reject && <div className="mt-2 text-sm font-bold text-fg/50">{rejectText(reject, round.need, round.category)}</div>}
        </div>
      )}
    </div>
  )
}
