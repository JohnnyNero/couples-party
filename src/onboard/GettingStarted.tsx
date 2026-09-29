import { useState } from 'react'
import type { Board } from '../daily/api'
import { useProfile } from '../profile/store'
import { useInstall } from '../ui/install'
import { card } from '../ui/styles'
import { Burst } from '../ui/fx'
import { hideList, listHidden, playedTogether } from './flags'

// Your first few days: what there is to do, ticked off as you do it — on Today, under
// the header, until it's all done or you put it away. Couples who paired more than a
// fortnight ago have found their way round already, and never see it.

type Paired = Extract<Board, { state: 'paired' }>
type Item = { key: string; label: string; done: boolean; hint?: string; action?: { label: string; run: () => void } }

const FORTNIGHT = 14 * 24 * 60 * 60 * 1000

export function GettingStarted({ d, onPlay, onProfile }: { d: Paired; onPlay: () => void; onProfile: () => void }) {
  const profile = useProfile()
  const install = useInstall()
  const [hidden, setHidden] = useState(listHidden)
  const pair = profile?.state === 'paired' ? profile : null
  if (hidden || !pair) return null
  if (Date.now() - Date.parse(pair.since) > FORTNIGHT) return null

  const slots = Object.values(d.kinds).filter(Boolean)
  const solved = slots.some((k) => k!.solve && k!.solve.status !== 'open')
  const set = slots.some((k) => k!.next || k!.mine)
  const items: Item[] = [
    { key: 'pair', label: `Pair up with ${d.partner}`, done: true },
    { key: 'set', label: `Set ${d.partner} a puzzle`, done: set, hint: 'Tap any puzzle on the board below — you make it, they solve it.' },
    { key: 'solve', label: `Solve one ${d.partner} set you`, done: solved, hint: `Once ${d.partner} has set you one, it says Play on the board.` },
    { key: 'play', label: 'Play today’s games together', done: playedTogether(), action: { label: 'Play', run: onPlay } },
    ...(install.kind === 'none'
      ? []
      : [{
          key: 'install',
          label: 'Put Coupled on your home screen',
          done: install.kind === 'installed',
          ...(install.kind === 'prompt'
            ? { action: { label: 'Add', run: () => void install.install() } }
            : { hint: 'In Safari: Share, then “Add to Home Screen”.' }),
        }]),
    { key: 'photo', label: 'Add your photo', done: !!pair.me.photo, action: { label: 'Add', run: onProfile } },
  ]
  const done = items.filter((i) => i.done).length
  const all = done === items.length
  const put = () => { hideList(); setHidden(true) }
  const next = items.find((i) => !i.done)?.key

  return (
    <section className={card + ' relative p-4 flex flex-col gap-3 animate-fade-up'}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-lg font-extrabold leading-tight">{all ? 'You’re all set!' : 'Getting started'}</div>
          <div className="text-xs font-bold text-fg/55">{all ? 'That’s everything — enjoy it.' : `${done} of ${items.length} done`}</div>
        </div>
        <button onClick={put} className="shrink-0 min-h-[40px] px-3 rounded-xl text-sm font-bold text-fg/50 press">
          {all ? 'Done' : 'Hide'}
        </button>
      </div>
      <div className="h-1.5 rounded-full bg-fg/10 overflow-hidden">
        <div className="h-full rounded-full bg-sage-ink transition-[width] duration-700" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      {!all && (
        <ul className="flex flex-col">
          {items.map((i) => (
            <li key={i.key} className="flex items-start gap-3 py-2 border-b border-fg/10 last:border-0">
              <span
                aria-hidden="true"
                className={'mt-0.5 shrink-0 w-6 h-6 rounded-full inline-flex items-center justify-center text-sm font-extrabold ' + (i.done ? 'bg-sage-ink text-white' : 'border-2 border-fg/25')}
              >
                {i.done ? '✓' : ''}
              </span>
              <div className="flex-1 min-w-0">
                <div className={'text-[0.95rem] font-bold leading-snug ' + (i.done ? 'text-fg/40 line-through decoration-2' : '')}>{i.label}</div>
                {!i.done && i.key === next && i.hint && <div className="mt-0.5 text-xs text-fg/55 leading-snug">{i.hint}</div>}
              </div>
              {!i.done && i.action && (
                <button onClick={i.action.run} className="shrink-0 min-h-[36px] px-3.5 rounded-xl bg-pa text-white text-sm font-extrabold press">
                  {i.action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {all && <Burst delay={200} count={16} />}
    </section>
  )
}
