import type { SessionState } from '../engine/state'
import { other } from '../engine/state'
import { LIST } from '../engine/phases'
import { currentAct, currentItem, lowestFreeSlot } from '../engine/list'
import { dispatch } from '../net'

// Dev-only overlay, mounted on ?debug=1. Shows public phase state only. Reaching the
// back half of the session by hand every time is the single biggest tax on iteration,
// so every phase gets a way past it.
export function DebugBar({ s }: { s: SessionState }) {
  const btn = 'px-3 py-1 border border-fg/30 uppercase tracking-wider hover:bg-fg/10 active:translate-y-px'
  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[0.7rem] bg-bg/90 border border-fg/20 p-2">
      <button className={btn} onClick={() => dispatch({ type: 'TIMEOUT' })}>skip</button>
      {s.phase === 'STAKE_SET' && (
        <button className={btn} onClick={() => dispatch({ type: 'SET_STAKE', text: 'loser makes the tea' })}>
          set-stake
        </button>
      )}
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
          for (let i = act.items.length; i < LIST.items; i++) {
            dispatch({ type: 'SUBMIT_ITEMS', player: act.author, text: `debug item ${i + 1}` })
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
    const item = currentItem(act)
    return (
      <button
        className={btn}
        onClick={() => {
          if (!item) return
          if (item.actualSlot === null) {
            dispatch({ type: 'PLACE_ITEM', player: other(act.author), slot: lowestFreeSlot(act, false) })
          }
          if (item.predictedSlot === null) {
            dispatch({ type: 'PLACE_ITEM', player: act.author, slot: lowestFreeSlot(act, true) })
          }
        }}
      >
        place-both
      </button>
    )
  }
  return null
}
