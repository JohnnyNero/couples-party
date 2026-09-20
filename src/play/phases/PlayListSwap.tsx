import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { LIST } from '../../engine/phases'
import { currentAct } from '../../engine/list'
import { dispatch } from '../../net/playroom'
import { PlayWaiting } from './PlayWaiting'

// The guardrail. Free, one item, no explanation asked for and none given — the act is
// built to be offensive and this keeps the door open without anyone having to say so.
export function PlayListSwap({ s, me }: { s: SessionState; me: PlayerId }) {
  const act = currentAct(s)!
  const [picked, setPicked] = useState<number | null>(null)
  const [text, setText] = useState('')

  if (me === act.author) return <PlayWaiting label="They may replace one" />

  if (picked !== null) {
    const submit = () => {
      const t = text.trim()
      if (t.length === 0) return
      dispatch({ type: 'SWAP_ITEM', player: me, index: picked, text: t })
    }
    return (
      <div className="h-full flex flex-col justify-center p-6 gap-3">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">Replacing</div>
        <div className="text-lg uppercase text-fg/50 line-through truncate">{act.items[picked].text}</div>
        <input
          className="w-full min-h-[56px] text-lg bg-fg text-bg px-4 outline-none border-b-4 border-accent placeholder:text-bg/30"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          maxLength={LIST.maxLen}
          placeholder="anything you like"
          autoComplete="off"
          autoFocus
        />
        <button
          className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
          onClick={submit}
        >
          Replace it
        </button>
        <button
          className="w-full min-h-[48px] border-2 border-fg/30 uppercase tracking-widest active:translate-y-px"
          onClick={() => { setPicked(null); setText('') }}
        >
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-5 gap-2">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">
        Replace one — free, no questions
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-auto">
        {act.items.map((item, i) => (
          <button
            key={item.id}
            className="min-h-[48px] w-full text-left px-3 border-2 border-fg/25 uppercase truncate active:translate-y-px"
            onClick={() => setPicked(i)}
          >
            {item.text}
          </button>
        ))}
      </div>
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-lg font-bold uppercase tracking-widest active:translate-y-px"
        onClick={() => dispatch({ type: 'SWAP_ITEM', player: me, index: null, text: '' })}
      >
        Keep all seven
      </button>
    </div>
  )
}
