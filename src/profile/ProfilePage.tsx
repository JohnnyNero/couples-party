import { useEffect, useRef, useState } from 'react'
import { api, DailyError } from '../daily/api'
import { Avatar } from '../ui/Avatar'
import { ThemeChoice } from '../views/ThemeToggle'
import { btnPrimary, card, eyebrow, field } from '../ui/styles'
import { clearProfile, patchMe, refreshProfile, useProfile } from './store'
import { shrinkPhoto } from './photo'
import { OurQuestions } from '../ideas/OurQuestions'
import { clearIdeas } from '../ideas/store'

// You, your partner, and the few settings there are: your name and photo, day or night,
// and unpairing. Opened from your avatar at the top of Home.

const NAME_KEY = 'couples-party:name' // the name Pairing remembers before you're paired
const localName = () => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } }

export function ProfilePage({ onClose, onUnpaired }: { onClose: () => void; onUnpaired: () => void }) {
  const profile = useProfile()
  const [ideasOpen, setIdeasOpen] = useState(false)
  useEffect(() => { void refreshProfile() }, [])

  const paired = profile?.state === 'paired' ? profile : null
  const onServer = profile?.state === 'paired' || profile?.state === 'waiting' ? profile : null
  const savedName = onServer ? onServer.me.name : localName()

  return (
    <div className="fixed inset-0 z-40 bg-bg flex flex-col animate-fade-up">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2 pr-14">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <h1 className="font-display text-2xl font-extrabold">Profile</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-5 pb-10">
        <div className="w-full max-w-md mx-auto flex flex-col gap-6 pt-2">
          <PhotoAndName
            key={savedName}
            name={savedName}
            photo={onServer?.me.photo ?? null}
            canSave={!!onServer}
          />

          {paired && (
            <section className={card + ' px-4 py-4 flex items-center gap-3'}>
              <div className="flex">
                <Avatar p="A" name={paired.me.name} size="md" className="ring-2 ring-card" />
                <Avatar p="B" name={paired.partner.name} size="md" className="-ml-2 ring-2 ring-card" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-extrabold leading-tight truncate">Paired with {paired.partner.name}</div>
                <div className="text-sm text-fg/55">Since {longDate(paired.since)}</div>
              </div>
            </section>
          )}

          {paired && (
            <button onClick={() => setIdeasOpen(true)} className={card + ' px-4 py-4 flex items-center gap-3 text-left active:translate-y-px'}>
              <span className="shrink-0 w-10 h-10 rounded-xl bg-tan-soft text-tan-ink inline-flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-display text-lg font-extrabold leading-tight">Our questions</span>
                <span className="block text-sm text-fg/55">Add your own to the games</span>
              </span>
              <span className="text-xl text-fg/40" aria-hidden="true">›</span>
            </button>
          )}

          <section className="flex flex-col gap-2">
            <div className={eyebrow}>Appearance</div>
            <ThemeChoice />
          </section>

          {onServer && <Unpair partner={paired?.partner.name ?? null} onDone={onUnpaired} />}
        </div>
      </main>
      {ideasOpen && paired && <OurQuestions partner={paired.partner.name} onClose={() => setIdeasOpen(false)} />}
    </div>
  )
}

function PhotoAndName({ name, photo, canSave }: { name: string; photo: string | null; canSave: boolean }) {
  const [draft, setDraft] = useState(name)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const changed = draft.trim() !== name && draft.trim().length > 0

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setNote(null)
    try {
      await fn()
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : e instanceof Error && /too big/.test(e.message) ? "That photo's too big — try another." : "Couldn't save that — try again.")
    } finally {
      setBusy(false)
    }
  }

  const saveName = () => run(async () => {
    const n = draft.trim()
    try { localStorage.setItem(NAME_KEY, n) } catch { /* private mode */ }
    if (canSave) {
      await api.setName(n)
      patchMe({ name: n })
    }
    setSaved(true)
    void refreshProfile()
  })

  const pickPhoto = (file: File | undefined) => {
    if (!file) return
    void run(async () => {
      const url = await shrinkPhoto(file)
      await api.setPhoto(url)
      patchMe({ photo: url })
    })
  }
  const removePhoto = () => run(async () => {
    await api.setPhoto(null)
    patchMe({ photo: null })
  })

  return (
    <section className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar p="A" name={draft.trim() || name || '?'} size="xl" photo={photo} className="!w-28 !h-28 !text-6xl" />
        {canSave && (
          <button
            onClick={() => picker.current?.click()}
            disabled={busy}
            aria-label={photo ? 'Change photo' : 'Add a photo'}
            className="absolute -right-1 -bottom-1 w-10 h-10 rounded-full bg-fg text-bg border-2 border-bg inline-flex items-center justify-center active:translate-y-px"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
        )}
        <input ref={picker} type="file" accept="image/*" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {canSave ? (
        photo ? (
          <button onClick={removePhoto} disabled={busy} className="text-sm font-bold text-fg/50 active:translate-y-px">Remove photo</button>
        ) : (
          <button onClick={() => picker.current?.click()} disabled={busy} className="text-sm font-bold text-accent-ink active:translate-y-px">Add a photo</button>
        )
      ) : (
        <div className="text-sm text-fg/50 text-center">Pair up on Today to add a photo.</div>
      )}

      <label className="w-full flex flex-col gap-1.5">
        <span className={eyebrow}>Your name</span>
        <div className="flex gap-2">
          <input
            className={field}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setSaved(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && changed) void saveName() }}
            maxLength={24}
            autoComplete="given-name"
          />
          {changed && (
            <button onClick={() => void saveName()} disabled={busy} className={btnPrimary + ' !w-auto px-5 shrink-0 !text-lg'}>
              Save
            </button>
          )}
        </div>
        <span className="h-5 text-sm font-bold">
          {note ? <span className="text-pa-ink">{note}</span> : saved ? <span className="text-sage-ink">Saved</span> : null}
        </span>
      </label>
    </section>
  )
}

// Two taps, on purpose: it can't be undone, and it's both of you, not just this phone.
function Unpair({ partner, onDone }: { partner: string | null; onDone: () => void }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const go = async () => {
    setBusy(true)
    setNote(null)
    try {
      await api.leaveCouple()
      clearProfile()
      clearIdeas()
      onDone()
    } catch {
      setNote("Couldn't reach the server — try again.")
      setBusy(false)
    }
  }
  if (!asking) {
    return (
      <button onClick={() => setAsking(true)} className="mt-4 self-center min-h-[48px] px-6 rounded-2xl font-bold text-pa-ink active:translate-y-px">
        {partner ? `Unpair from ${partner}` : 'Cancel pairing'}
      </button>
    )
  }
  return (
    <section className="rounded-3xl border-2 border-pa bg-pa-soft px-4 py-4 flex flex-col gap-3">
      <div className="font-display text-xl font-extrabold leading-tight">{partner ? `Unpair from ${partner}?` : 'Cancel pairing?'}</div>
      {partner && (
        <div className="text-sm text-fg/75 leading-snug">
          It unpairs both phones. Your daily puzzles, streak and Memories are deleted, for both of you, and can’t be brought back.
        </div>
      )}
      {note && <div className="text-sm font-bold text-pa-ink">{note}</div>}
      <div className="flex gap-2">
        <button onClick={() => setAsking(false)} disabled={busy} className="flex-1 min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px">
          Keep
        </button>
        <button onClick={() => void go()} disabled={busy} className="flex-1 min-h-[52px] rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px disabled:opacity-50">
          Unpair
        </button>
      </div>
    </section>
  )
}

function longDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}
