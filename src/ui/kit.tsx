import type { ReactNode } from 'react'
import type { PlayerId, SessionState } from '../engine/state'
import { Avatar, inkOf } from './Avatar'
import { card, eyebrow } from './styles'
import { playerName } from '../views/list'

// The question or statement a round is about, as a card: a small line over it, then the
// words big. `size` steps down for long prompts on a phone.
export function PromptCard({ over, children, size = 'lg', className = '' }: { over?: ReactNode; children: ReactNode; size?: 'md' | 'lg'; className?: string }) {
  return (
    <section className={card + ' px-5 py-6 ' + className}>
      {over && <div className={eyebrow + ' text-accent-ink'}>{over}</div>}
      <div className={'font-display font-extrabold leading-[1.1] tracking-tight break-words ' + (over ? 'mt-2 ' : '') + (size === 'lg' ? 'text-[2rem] sm:text-5xl' : 'text-2xl sm:text-4xl')}>
        {children}
      </div>
    </section>
  )
}

// Who's answered, as the two of you: a faded avatar until you're in, then a tick.
export function WhoIsIn({ s, done, big = false }: { s: SessionState; done: Record<PlayerId, boolean>; big?: boolean }) {
  return (
    <div className={'flex justify-center ' + (big ? 'gap-10' : 'gap-6')}>
      {(['A', 'B'] as PlayerId[]).map((p) => (
        <span key={p} className={'flex items-center gap-2 font-bold transition-opacity ' + (big ? 'text-xl ' : 'text-sm ') + (done[p] ? '' : 'opacity-40')}>
          <span className="relative">
            <Avatar p={p} name={playerName(s, p)} size={big ? 'md' : 'sm'} />
            {done[p] && (
              <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-fg border-2 border-bg inline-flex items-center justify-center animate-pop">
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="rgb(var(--bg))" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
            )}
          </span>
          <span className={done[p] ? inkOf(p) : ''}>{done[p] ? 'In' : 'Thinking…'}</span>
        </span>
      ))}
    </div>
  )
}

// A hand of five, one bar per finger: up in your colour, down as a stub.
export function Hand({ fingers, p, total = 5, big = false }: { fingers: number; p: PlayerId; total?: number; big?: boolean }) {
  const heights = [0.72, 0.92, 1, 0.88, 0.6]
  const h = big ? 52 : 38
  return (
    <div className="flex items-end gap-1" style={{ height: h }} aria-label={`${fingers} of ${total} fingers up`}>
      {Array.from({ length: total }, (_, i) => {
        const up = i < fingers
        return (
          <span
            key={i}
            className={'rounded-full transition-all duration-500 ' + (big ? 'w-3.5 ' : 'w-2.5 ') + (up ? (p === 'A' ? 'bg-pa' : 'bg-pb') : 'bg-fg/15')}
            style={{ height: up ? h * heights[i] : h * 0.28 }}
          />
        )
      })}
    </div>
  )
}

// A soft full-screen "hang on" — for a phone with nothing to do this moment.
export function Waiting({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-pa animate-pulse" />
        <span className="w-2.5 h-2.5 rounded-full bg-pb animate-pulse [animation-delay:200ms]" />
      </div>
      <div className="font-display text-2xl font-bold leading-tight">{title}</div>
      {sub && <div className="text-sm text-fg/60">{sub}</div>}
    </div>
  )
}
