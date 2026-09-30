import { useEffect, useState } from 'react'
import { DailyError, type CoupleEntry } from '../daily/api'
import { Avatar } from '../ui/Avatar'
import { eyebrow } from '../ui/styles'
import { TypingDots } from '../ui/kit'
import { profileNow } from '../profile/store'
import { refreshCouples, startAnother, switchTo, useCouples } from './store'

// The couples you're in, the one you're using ticked: tap another to switch to it, or
// add another couple. On the profile page, and in the switcher on Today.

const NAME_KEY = 'couples-party:name'

export const coupleLabel = (c: CoupleEntry) => (c.partner ? `You & ${c.partner.name}` : 'Waiting for someone to join')

export function CouplesList({ heading = true }: { heading?: boolean }) {
  const couples = useCouples()
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => { void refreshCouples() }, [])

  const run = (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setNote(null)
    fn().catch((e) => {
      setBusy(null)
      setNote(e instanceof DailyError ? e.message : 'Couldn’t reach the server — try again.')
    })
  }
  const another = () => run('add', async () => {
    // Setting up the new one starts from your name.
    const p = profileNow()
    if (p && p.state !== 'single') try { localStorage.setItem(NAME_KEY, p.me.name) } catch { /* fine */ }
    await startAnother()
  })

  return (
    <section className="flex flex-col gap-2">
      {heading && <div className={eyebrow}>Your couples</div>}
      {couples.map((c) => (
        <button
          key={c.id}
          onClick={() => { if (!c.active) run(c.id, () => switchTo(c.id)) }}
          disabled={!!busy}
          aria-current={c.active}
          className={
            'w-full min-h-[64px] flex items-center gap-3 rounded-2xl border-2 bg-card px-4 py-2.5 text-left press ' +
            (c.active ? 'border-fg' : 'border-fg/15')
          }
        >
          <span className="flex shrink-0">
            <Avatar p="A" name={c.me.name} photo={c.me.photo} size="md" className="ring-2 ring-card" />
            {c.partner ? (
              <Avatar p="B" name={c.partner.name} photo={c.partner.photo} size="md" className="-ml-2.5 ring-2 ring-card" />
            ) : (
              <span className="-ml-2.5 w-10 h-10 rounded-full border-2 border-dashed border-pb/60 bg-pb-soft inline-flex items-center justify-center font-display font-extrabold text-pb-ink">?</span>
            )}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-lg font-extrabold leading-tight truncate">{coupleLabel(c)}</span>
            <span className="block text-sm text-fg/55">
              {busy === c.id ? <span className="inline-flex items-center gap-1.5">Switching<TypingDots /></span> : c.active ? 'You’re here now' : 'Tap to switch'}
            </span>
          </span>
          {c.active && (
            <span className="shrink-0 w-7 h-7 rounded-full bg-fg text-bg inline-flex items-center justify-center" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
          )}
        </button>
      ))}
      <button
        onClick={another}
        disabled={!!busy}
        className="w-full min-h-[56px] flex items-center gap-3 rounded-2xl border-2 border-dashed border-fg/25 px-4 text-left press"
      >
        <span className="shrink-0 w-10 h-10 rounded-full bg-fg/10 inline-flex items-center justify-center text-2xl font-bold text-fg/60" aria-hidden="true">+</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold">{busy === 'add' ? 'Setting up…' : 'Add another couple'}</span>
          <span className="block text-sm text-fg/55 leading-snug">A friend, a sibling, your mum — anyone you’d play with. Everyone keeps their own games.</span>
        </span>
      </button>
      {note && <div className="text-sm font-bold text-pa-ink text-center" role="alert">{note}</div>}
    </section>
  )
}
