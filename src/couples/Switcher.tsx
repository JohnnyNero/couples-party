import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackLayer } from '../ui/back'
import { card } from '../ui/styles'
import { useProfile } from '../profile/store'
import { openWelcome } from '../onboard/flags'
import { CouplesList, coupleLabel } from './CouplesList'
import { refreshCouples, switchTo, useCouples } from './store'

// On Today, for anyone in more than one couple: which one this is, and a tap to switch.

export function useManyCouples(): boolean {
  const couples = useCouples()
  useEffect(() => { void refreshCouples() }, [])
  return couples.length > 1
}

// The little "▾" beside Today's title, and the sheet it opens (on the page, not inside
// the title).
export function SwitchButton({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  useBackLayer(open, () => setOpen(false))
  return (
    <>
      <button onClick={() => setOpen(true)} className="max-w-full inline-flex items-center gap-1.5 text-left press" aria-label="Switch couple">
        <span className="min-w-0 truncate">{children}</span>
        <svg viewBox="0 0 24 24" className="shrink-0 w-6 h-6 text-fg/45" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6" /></svg>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md mx-auto rounded-t-3xl bg-bg px-5 pt-5 pb-8 animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl font-extrabold mb-3">Switch couple</h2>
            <CouplesList heading={false} />
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// On Today while setting up another couple: carry on, or go back.
export function SettingUpCard() {
  const profile = useProfile()
  const couples = useCouples()
  const [busy, setBusy] = useState(false)
  if (profile?.state !== 'single' || couples.length === 0) return null
  return (
    <section className={card + ' p-5 flex flex-col gap-3'}>
      <div>
        <div className="font-display text-xl font-extrabold leading-tight">Setting up another couple</div>
        <p className="mt-1 text-sm text-fg/65 leading-snug">Invite them, or type in the code they sent you.</p>
      </div>
      <button onClick={() => openWelcome('you')} className="min-h-[52px] rounded-2xl bg-pa text-white font-display text-lg font-extrabold press">Set it up</button>
      {couples.map((c) => (
        <button
          key={c.id}
          disabled={busy}
          onClick={() => { setBusy(true); switchTo(c.id).catch(() => setBusy(false)) }}
          className="min-h-[44px] text-sm font-bold text-fg/55"
        >
          Back to {coupleLabel(c)}
        </button>
      ))}
    </section>
  )
}
