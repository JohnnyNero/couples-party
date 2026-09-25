import { useEffect, useRef, useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { CLASH } from '../../engine/phases'
import { startsRight } from '../../engine/clash'
import { dispatch } from '../../net'
import { playerName } from '../../views/list'

// Six boxes, one letter. Enter jumps to the next box; nothing leaves the phone until
// Done — or, if the clock gets there first, whatever's typed is sent just before it.
export function PlayClashWrite({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.clash!
  const round = g.rounds[g.current]
  const sent = round.answers[me] !== null
  const [answers, setAnswers] = useState<string[]>(() => round.categories.map(() => ''))
  const boxes = useRef<Array<HTMLInputElement | null>>([])

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
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div className="text-lg uppercase tracking-wide text-fg/55">Sent · waiting for {playerName(s, other(me))}</div>
      </div>
    )
  }

  const set = (i: number, v: string) => setAnswers((prev) => prev.map((a, j) => (j === i ? v : a)))
  return (
    <div className="h-full flex flex-col p-5 gap-3 overflow-y-auto">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">Category Clash · round {round.index}</div>
          <div className="text-sm text-fg/60">Everything starts with…</div>
        </div>
        <div className="font-display text-6xl font-bold text-accent leading-none">{round.letter}</div>
      </div>
      <div className="flex flex-col gap-2">
        {round.categories.map((cat, i) => {
          const v = answers[i]
          const bad = v.trim() !== '' && !startsRight(v, round.letter)
          return (
            <label key={i} className="block">
              <span className="block text-[0.65rem] uppercase tracking-[0.2em] text-fg/50 mb-0.5">{cat}</span>
              <input
                ref={(el) => { boxes.current[i] = el }}
                className={
                  'w-full min-h-[44px] text-lg bg-ink text-paper px-3 outline-none border-b-4 rounded-t-lg ' +
                  (bad ? 'border-fg/30' : 'border-accent')
                }
                value={v}
                onChange={(e) => set(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  boxes.current[i + 1]?.focus()
                }}
                maxLength={CLASH.maxLen}
                placeholder={`${round.letter}…`}
                autoFocus={i === 0}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint={i < round.categories.length - 1 ? 'next' : 'done'}
              />
            </label>
          )
        })}
      </div>
      <button
        className="w-full min-h-[52px] mt-1 rounded-xl bg-accent text-bg text-lg font-bold uppercase tracking-widest active:translate-y-px"
        onClick={() => dispatch({ type: 'SUBMIT_CLASH', player: me, answers })}
      >
        Done
      </button>
    </div>
  )
}
