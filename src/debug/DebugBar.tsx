import type { SessionState } from '../engine/state'
import { dispatch } from '../net/playroom'

export function DebugBar({ s }: { s: SessionState }) {
  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex gap-2 text-sm font-board bg-fg/10 p-2">
      <button className="px-3 py-1 bg-fg/20" onClick={() => dispatch({ type: 'TIMEOUT' })}>skip-phase</button>
      <button className="px-3 py-1 bg-fg/20" onClick={() => {
        dispatch({ type: 'SUBMIT_WORD', player: 'A', word: 'debugone' })
        dispatch({ type: 'SUBMIT_WORD', player: 'B', word: 'debugtwo' })
      }}>fill-both</button>
      <button className="px-3 py-1 bg-fg/20" onClick={() => {
        dispatch({ type: 'SUBMIT_WORD', player: 'A', word: 'samesame' })
        dispatch({ type: 'SUBMIT_WORD', player: 'B', word: 'samesame' })
      }}>force-converge</button>
      <span className="px-2 py-1">phase: {s.phase}</span>
    </div>
  )
}
