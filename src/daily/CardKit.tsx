import type { ReactNode } from 'react'
import { card } from '../ui/styles'

// The shared shell every daily-puzzle card is built from — Their Word, The Dial, and
// whatever follows them — so a new one looks and behaves like the others for free.

export function Card({
  title,
  sub,
  corner,
  children,
}: {
  title: string
  sub?: string
  corner?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={card + ' p-6'}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {sub && <div className="text-[0.6rem] uppercase tracking-[0.25em] text-fg/40 mb-1">{sub}</div>}
          <h2 className="font-display text-3xl font-bold tracking-tight">{title}</h2>
        </div>
        {corner}
      </div>
      {children}
    </section>
  )
}

export function Step({ n, label, children }: { n: number; label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-fg/[0.04] px-4 py-3">
      <div className="text-[0.6rem] uppercase tracking-[0.3em] text-fg/40 mb-1.5">
        <span className="text-accent font-bold">{n}</span> · {label}
      </div>
      {children}
    </div>
  )
}

export function BigButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="shrink-0 min-h-[44px] px-5 rounded-xl bg-accent text-bg font-bold uppercase tracking-widest text-sm active:translate-y-px">
      {children}
    </button>
  )
}

export function SmallButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="shrink-0 min-h-[40px] px-3 rounded-xl border-2 border-fg/15 text-fg/60 text-xs font-bold uppercase tracking-widest active:translate-y-px">
      {children}
    </button>
  )
}
