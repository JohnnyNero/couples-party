import type { SessionState } from '../engine/state'
import { other } from '../engine/state'
import { currentAct, SLOTS } from '../engine/list'
import { dispatch } from '../net'

// Dev-only overlay, mounted on ?debug=1. Shows public phase state only. Reaching the
// back half of the session by hand every time is the single biggest tax on iteration,
// so every phase gets a way past it.
export function DebugBar({ s }: { s: SessionState }) {
  const btn = 'px-3 py-1 border border-fg/30 uppercase tracking-wider hover:bg-fg/10 active:translate-y-px'
  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[0.7rem] bg-bg/90 border border-fg/20 p-2">
      <button className={btn} onClick={() => dispatch({ type: 'TIMEOUT' })}>skip</button>
      <ListButtons s={s} btn={btn} />
      {s.phase === 'LIKELY_ROUND' && (
        <button
          className={btn}
          onClick={() => {
            dispatch({ type: 'PICK_LIKELY', player: 'A', pick: Math.random() < 0.5 ? 'A' : 'B' })
            dispatch({ type: 'PICK_LIKELY', player: 'B', pick: Math.random() < 0.5 ? 'A' : 'B' })
          }}
        >
          fill-both
        </button>
      )}
      {s.phase === 'MM_ANSWER' && (
        <button
          className={btn}
          onClick={() => {
            dispatch({ type: 'SUBMIT_MRMRS', player: 'A', answer: 'pizza', predict: 'chips' })
            dispatch({ type: 'SUBMIT_MRMRS', player: 'B', answer: 'chips', predict: 'curry' })
          }}
        >
          fill-both
        </button>
      )}
      {s.phase === 'MM_JUDGE' && (
        <button
          className={btn}
          onClick={() => {
            dispatch({ type: 'JUDGE', player: 'A', correct: true })
            dispatch({ type: 'JUDGE', player: 'B', correct: false })
          }}
        >
          judge-both
        </button>
      )}
      {s.phase === 'FINGER_ROUND' && (
        <button
          className={btn}
          onClick={() => {
            dispatch({ type: 'SUBMIT_FINGER', player: 'A', applies: Math.random() < 0.5 })
            dispatch({ type: 'SUBMIT_FINGER', player: 'B', applies: Math.random() < 0.5 })
          }}
        >
          fill-both
        </button>
      )}
      {s.phase === 'WAVE_CLUE' && s.wave && (
        <button
          className={btn}
          onClick={() => dispatch({ type: 'SUBMIT_CLUE', player: s.wave!.rounds[s.wave!.current].psychic, text: 'debug clue' })}
        >
          fill-clue
        </button>
      )}
      {s.phase === 'WAVE_GUESS' && s.wave && (
        <button
          className={btn}
          onClick={() => dispatch({
            type: 'SUBMIT_GUESS',
            player: other(s.wave!.rounds[s.wave!.current].psychic),
            value: Math.floor(Math.random() * 101),
          })}
        >
          fill-guess
        </button>
      )}
      {s.phase === 'DRAW_SKETCH' && s.draw && (
        <button
          className={btn}
          onClick={() => dispatch({
            type: 'SUBMIT_DRAWING',
            player: s.draw!.rounds[s.draw!.current].drawer,
            answer: 'debug',
            strokes: [[[0.2, 0.2], [0.8, 0.8]]],
          })}
        >
          fill-drawing
        </button>
      )}
      {s.phase === 'DRAW_GUESS' && s.draw && (
        <button
          className={btn}
          onClick={() => dispatch({
            type: 'SUBMIT_DRAW_GUESS',
            player: other(s.draw!.rounds[s.draw!.current].drawer),
            text: 'a guess',
          })}
        >
          fill-guess
        </button>
      )}
      <span className="px-2 uppercase tracking-wider text-fg/50">{s.phase}</span>
    </div>
  )
}

function ListButtons({ s, btn }: { s: SessionState; btn: string }) {
  const act = currentAct(s)
  if (!act) return null
  if (s.phase === 'LIST_PLACE') {
    return (
      <button
        className={btn}
        onClick={() => {
          // Fires enough PLACE_ITEM actions to clear every remaining item, both sides —
          // tracked locally since dispatch doesn't hand back the state it produced.
          const usedA = new Set(act.items.map((i) => i.predictedSlot).filter((n): n is number => n !== null))
          const usedB = new Set(act.items.map((i) => i.actualSlot).filter((n): n is number => n !== null))
          for (let i = act.placeIndex; i < act.items.length; i++) {
            const slotA = SLOTS.find((n) => !usedA.has(n))!
            usedA.add(slotA)
            dispatch({ type: 'PLACE_ITEM', player: act.author, slot: slotA })
            const slotB = SLOTS.find((n) => !usedB.has(n))!
            usedB.add(slotB)
            dispatch({ type: 'PLACE_ITEM', player: other(act.author), slot: slotB })
          }
        }}
      >
        place-both
      </button>
    )
  }
  return null
}
