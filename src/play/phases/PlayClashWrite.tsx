import { useEffect, useRef, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { CLASH } from '../../engine/phases'
import { startsRight } from '../../engine/clash'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'
import { LetterTile, Waiting } from '../../ui/kit'
import { btnAccent } from '../../ui/styles'
import { KeyField, Keys } from '../../ui/keys'

// Six boxes, one letter. Enter jumps to the next box; nothing leaves the phone until
// Done — or, if the clock gets there first, whatever's typed is sent just before it.
export function PlayClashWrite({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.clash!
  const round = g.rounds[g.current]
  const sent = round.answers[me] !== null
  const [answers, setAnswers] = useState<string[]>(() => round.categories.map(() => ''))

  const latest = useRef(answers)
  latest.current = answers
  useEffect(() => {
    if (sent || s.phaseEndsAt == null) return
    const id = setTimeout(() => {
      dispatch({ type: 'SUBMIT_CLASH', player: me, answers: latest.current })
    }, Math.max(0, s.phaseEndsAt - Date.now() - 600))
    return () => clearTimeout(id)
  }, [sent, s.phaseEndsAt, me])

  if (sent) {
    return <Waiting title="Sent" sub={round.answers[other(me)] !== null ? 'Revealing…' : `Waiting for ${playerName(s, other(me))}`} />
  }

  const set = (i: number, v: string) => setAnswers((prev) => prev.map((a, j) => (j === i ? v : a)))
  return (
    <Keys className="h-full" bodyClassName="px-5 pb-3 gap-3">
      <div className="flex items-center gap-3">
        <LetterTile letter={round.letter} />
        <div className="font-display text-xl font-bold leading-tight">Everything starts with {round.letter}</div>
      </div>
      <div className="flex flex-col gap-2">
        {round.categories.map((cat, i) => {
          const v = answers[i]
          const bad = v.trim() !== '' && !startsRight(v, round.letter)
          return (
            <div key={i}>
              <span className="block text-sm font-extrabold text-fg/70 mb-1">{cat}</span>
              <KeyField
                className={
                  'w-full min-h-[48px] rounded-xl border-2 bg-card px-3 text-lg font-bold ' +
                  (bad ? 'border-fg/25 text-fg/50 line-through decoration-2' : v.trim() ? 'border-fg' : 'border-fg/40')
                }
                value={v}
                onChange={(t) => set(i, t)}
                maxLength={CLASH.maxLen}
                placeholder={`${round.letter}…`}
                autoFocus={i === 0}
                caps="words"
              />
            </div>
          )
        })}
      </div>
      <button
        className={btnAccent + ' shrink-0 mt-1'}
        onClick={() => dispatch({ type: 'SUBMIT_CLASH', player: me, answers })}
      >
        Done
      </button>
    </Keys>
  )
}
