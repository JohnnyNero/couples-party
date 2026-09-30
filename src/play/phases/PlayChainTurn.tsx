import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { CHAIN } from '../../engine/phases'
import { dispatch } from '../../net'
import { Clock } from '../../board/Clock'
import { ChainTrail } from '../../views/ChainTrail'
import { aLetter, rejectText } from '../../views/chain'
import { rejectable } from '../../engine/chain'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { eyebrow, field } from '../../ui/styles'
import { KeyField, Keys } from '../../ui/keys'
import { TypingDots, useDoing } from '../../ui/kit'

// Your turn: one box, the letter you need, and the clock. A word that doesn't pass
// comes back with the reason and stays in the box to fix — the clock doesn't wait.
export function PlayChainTurn({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.chain!
  const round = g.rounds[g.current]
  const mine = round.turn === me
  // On their turn: whether they're typing their word right now.
  const theirDoing = useDoing(s, round.turn)
  const [word, setWord] = useState('')
  const send = () => {
    if (word.trim()) dispatch({ type: 'CHAIN_WORD', player: me, word })
  }
  const reject = round.reject && round.reject.player === round.turn ? round.reject : null
  // Their last answer, if it isn't on the list: yours to accept (just play on) or reject.
  const doubtful = rejectable(round)

  return (
    <Keys className="h-full" bodyClassName={'px-5 gap-4 ' + (mine ? 'pb-2' : 'pb-6')}>
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
        <div className="flex flex-col gap-2">
          {doubtful && (
            <div className="flex items-center gap-2 rounded-2xl bg-fg/[0.06] px-3 py-2">
              <div className="flex-1 min-w-0 text-sm font-bold leading-snug">
                <span className={'capitalize ' + inkOf(doubtful.by!)}>“{doubtful.word}”</span>
                <span className="text-fg/60"> isn’t on our list. Real {round.category.toLowerCase()}?</span>
              </div>
              <button
                onClick={() => dispatch({ type: 'CHAIN_REJECT', player: me })}
                className="press shrink-0 min-h-[40px] px-3.5 rounded-full border-2 border-pa text-pa-ink text-sm font-extrabold"
              >
                Reject
              </button>
            </div>
          )}
          <div className="text-center font-display text-2xl font-extrabold">
            Your go · you need <span className={inkOf(me)}>{aLetter(round.need)}</span>
          </div>
          <KeyField
            className={field + ' text-2xl'}
            value={word}
            onChange={setWord}
            onEnter={send}
            enter="Go"
            canEnter={!!word.trim()}
            maxLength={CHAIN.maxLen}
            placeholder={`${round.need.toUpperCase()}…`}
            autoFocus
            caps="none"
          />
          <div className="h-5 text-sm font-bold text-pa-ink text-center">
            {reject && rejectText(reject, round.need, round.category)}
          </div>
        </div>
      ) : (
        <div className="pb-10 text-center">
          <div className="flex items-center justify-center gap-2 font-display text-2xl font-extrabold text-fg/70">
            <span className="animate-breathe"><Avatar p={round.turn} name={playerName(s, round.turn)} size="md" /></span>
            {playerName(s, round.turn)} needs {aLetter(round.need)}
          </div>
          <div className={'mt-1 h-5 inline-flex items-center gap-1.5 text-sm font-extrabold ' + inkOf(round.turn) + (theirDoing ? '' : ' invisible')}>
            {theirDoing ?? ''}<TypingDots />
          </div>
          {reject && <div className="mt-2 text-sm font-bold text-fg/50">{rejectText(reject, round.need, round.category)}</div>}
          {doubtful && doubtful.by === me && (
            <div className="mt-2 text-sm font-bold text-fg/50">“{doubtful.word}” isn’t on our list — {playerName(s, round.turn)} can reject it</div>
          )}
        </div>
      )}
    </Keys>
  )
}
