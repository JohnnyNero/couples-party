import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { currentAct } from '../../engine/list'
import { dispatch } from '../../net'
import { DragRankList } from '../DragRankList'
import { PlayWaiting } from './PlayWaiting'

// Both players rank the same seven items at once, in private: the author drags to guess
// where the ranker will put each one, the ranker drags their real order. One submission
// each — no changing your mind once it lands.
export function PlayListPlace({ s, me }: { s: SessionState; me: PlayerId }) {
  const act = currentAct(s)!
  const byAuthor = me === act.author
  const submitted = act.items.every((i) => (byAuthor ? i.predictedSlot : i.actualSlot) !== null)

  const [order, setOrder] = useState<string[]>(() => act.items.map((i) => i.id))

  if (submitted) return <PlayWaiting label="Locked in — waiting" />

  const rows = act.items.map((i) => ({ id: i.id, text: i.text }))

  return (
    <div className="h-full flex flex-col justify-center p-5 gap-3">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">
        {byAuthor ? 'Drag to guess their order' : 'Drag into your real order'}
      </div>
      <div className="text-[0.6rem] uppercase tracking-[0.25em] text-fg/30">Top = 1st</div>
      <DragRankList rows={rows} order={order} onChange={setOrder} />
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={() => dispatch({ type: 'SUBMIT_ORDER', player: me, order })}
      >
        Lock in my order
      </button>
    </div>
  )
}
