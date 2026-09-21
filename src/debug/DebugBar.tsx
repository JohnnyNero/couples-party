import type { SessionState } from '../engine/state'
import { other } from '../engine/state'
import { LIST } from '../engine/phases'
import { currentAct } from '../engine/list'
import { dispatch } from '../net'

// Dev-only overlay, mounted on ?debug=1. Shows public phase state only. Reaching the
// back half of the session by hand every time is the single biggest tax on iteration,
// so every phase gets a way past it.
export function DebugBar({ s }: { s: SessionState }) {
  const btn = 'px-3 py-1 border border-fg/30 uppercase tracking-wider hover:bg-fg/10 active:translate-y-px'
  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[0.7rem] bg-bg/90 border border-fg/20 p-2">
      <button className={btn} onClick={() => dispatch({ type: 'TIMEOUT' })}>skip</button>
      {s.phase === 'MELD_TYPE' && (
        <>
          <button
            className={btn}
            onClick={() => {
              dispatch({ type: 'SUBMIT_WORD', player: 'A', word: 'debugone' })
              dispatch({ type: 'SUBMIT_WORD', player: 'B', word: 'debugtwo' })
            }}
          >
            fill-both
          </button>
          <button
            className={btn}
            onClick={() => {
              dispatch({ type: 'SUBMIT_WORD', player: 'A', word: 'samesame' })
              dispatch({ type: 'SUBMIT_WORD', player: 'B', word: 'samesame' })
            }}
          >
            converge
          </button>
        </>
      )}
      <ListButtons s={s} btn={btn} />
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
      <span className="px-2 uppercase tracking-wider text-fg/50">{s.phase}</span>
    </div>
  )
}

function ListButtons({ s, btn }: { s: SessionState; btn: string }) {
  const act = currentAct(s)
  if (!act) return null
  if (s.phase === 'LIST_WRITE') {
    return (
      <button
        className={btn}
        onClick={() => {
          const picked = new Set(act.items.map((i) => i.poolIndex))
          let i = 0
          for (let n = act.items.length; n < LIST.items; n++) {
            while (picked.has(i)) i++
            dispatch({ type: 'SUBMIT_ITEMS', player: act.author, poolIndex: i })
            picked.add(i)
            i++
          }
        }}
      >
        fill-list
      </button>
    )
  }
  if (s.phase === 'LIST_SWAP') {
    return (
      <button
        className={btn}
        onClick={() => dispatch({ type: 'SWAP_ITEM', player: other(act.author), index: null, text: '' })}
      >
        keep-all
      </button>
    )
  }
  if (s.phase === 'LIST_PLACE') {
    const order = act.items.map((i) => i.id)
    return (
      <button
        className={btn}
        onClick={() => {
          dispatch({ type: 'SUBMIT_ORDER', player: act.author, order })
          dispatch({ type: 'SUBMIT_ORDER', player: other(act.author), order })
        }}
      >
        place-both
      </button>
    )
  }
  return null
}
