import type { SessionState } from '../engine/state'
import { dispatch } from '../net/playroom'

// Dev-only overlay, mounted on ?debug=1. Shows public phase state only.
export function DebugBar({ s }: { s: SessionState }) {
  const btn = 'px-3 py-1 border border-fg/30 uppercase tracking-wider hover:bg-fg/10 active:translate-y-px'
  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[0.7rem] bg-bg/90 border border-fg/20 p-2">
      <button className={btn} onClick={() => dispatch({ type: 'TIMEOUT' })}>skip</button>
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
      <button
        className={btn}
        onClick={() => {
          for (const p of ['A', 'B'] as const)
            for (let i = 0; i < 5; i++) dispatch({ type: 'SUBMIT_FORFEITS', player: p, text: `${p} forfeit ${i}` })
        }}
      >
        fill-pot
      </button>
      <span className="px-2 uppercase tracking-wider text-fg/50">{s.phase}</span>
    </div>
  )
}
