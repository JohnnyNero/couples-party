import { useEffect, useRef, useState } from 'react'
import { api, DailyError } from '../daily/api'
import { Avatar } from '../ui/Avatar'
import { Wordmark } from '../ui/Logo'
import { btnAccent, eyebrow, field } from '../ui/styles'
import { refreshProfile, useProfile } from '../profile/store'
import { shrinkPhoto } from '../profile/photo'
import { forgetInvite, type InviteLink } from './invite'

// Where an invite link lands: "Johnny's invited you". Your name, a photo if you like,
// one button — and you're paired, then a welcome, then Today. A phone that's already
// paired, or a link that's been used, gets told so and sent on to the app.

const NAME_KEY = 'couples-party:name'
const savedName = () => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } }

type Step = { kind: 'form' } | { kind: 'done'; partner: string } | { kind: 'dead'; why: string }

export function Invite({ invite, onDone }: { invite: InviteLink; onDone: () => void }) {
  const from = invite.from || 'Your partner'
  const profile = useProfile()
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const [name, setName] = useState(savedName)
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => { void refreshProfile() }, [])
  // Already paired on this phone: nothing to join.
  const alreadyWith = profile?.state === 'paired' && step.kind === 'form' ? profile.partner.name : null

  const finish = () => { forgetInvite(); onDone() }

  const join = async () => {
    const n = name.trim()
    if (!n) return setNote('Your name first.')
    setBusy(true)
    setNote(null)
    try { localStorage.setItem(NAME_KEY, n) } catch { /* private mode */ }
    try {
      await api.joinCouple(invite.code, n)
    } catch (e) {
      setBusy(false)
      const msg = e instanceof DailyError ? e.message : ''
      if (/didn't work/.test(msg)) return setStep({ kind: 'dead', why: `This invite has already been used, or ${from} has started again. Ask them to send a new one.` })
      if (/already paired/i.test(msg)) return setStep({ kind: 'dead', why: 'This phone is already paired.' })
      return setNote(msg || "Couldn't reach the server — try again.")
    }
    // Paired. The photo is a nice-to-have: if it doesn't go through, it can be added later.
    if (photo) await api.setPhoto(photo).catch(() => {})
    const p = await refreshProfile()
    setBusy(false)
    setStep({ kind: 'done', partner: p?.state === 'paired' ? p.partner.name : from })
  }

  const pick = (file: File | undefined) => {
    if (!file) return
    shrinkPhoto(file).then(setPhoto).catch(() => setNote("Couldn't use that photo — try another."))
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="min-h-full w-full max-w-md mx-auto px-6 py-10 flex flex-col">
        {alreadyWith ? (
          <Centered
            title={`You’re already paired with ${alreadyWith}`}
            sub="This phone can only be in one couple. To pair with someone else, unpair first from your profile."
            action="Open the app"
            onAction={finish}
          />
        ) : step.kind === 'dead' ? (
          <Centered title="That invite didn’t work" sub={step.why} action="Open the app" onAction={finish} />
        ) : step.kind === 'done' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 animate-fade-up">
            <div className="flex">
              <Avatar p="A" name={name} photo={photo} size="xl" className="ring-4 ring-bg" />
              <Avatar p="B" name={step.partner} size="xl" className="-ml-5 ring-4 ring-bg" />
            </div>
            <div>
              <h1 className="font-display text-4xl font-extrabold leading-tight">You’re paired!</h1>
              <p className="mt-2 text-fg/65 leading-snug">
                You and {step.partner} are in. Every day there are six little puzzles you set for each
                other — and a game night whenever you want one.
              </p>
            </div>
            <button className={btnAccent} onClick={finish}>Let’s go</button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-7 animate-fade-up">
            <div className="text-center">
              <Wordmark className="font-display text-xl font-extrabold" />
              <h1 className="mt-2 font-display text-[2.1rem] font-extrabold leading-[1.1]">{from} has invited you</h1>
              <p className="mt-2 text-fg/65 leading-snug">
                Daily puzzles you set for each other, and a game night for the two of you. First, who are you?
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button onClick={() => picker.current?.click()} aria-label={photo ? 'Change photo' : 'Add a photo'} className="relative rounded-full active:translate-y-px">
                {photo || name.trim() ? (
                  <Avatar p="A" name={name.trim() || '?'} photo={photo} size="xl" className="!w-28 !h-28 !text-6xl" />
                ) : (
                  <span className="w-28 h-28 rounded-full border-2 border-dashed border-fg/30 text-fg/40 inline-flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
                    </svg>
                  </span>
                )}
              </button>
              <button onClick={() => picker.current?.click()} className="text-sm font-bold text-accent-ink">
                {photo ? 'Change photo' : 'Add a photo (optional)'}
              </button>
              <input ref={picker} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={eyebrow}>Your name</span>
              <input
                className={field}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void join() }}
                maxLength={24}
                autoComplete="given-name"
                placeholder="What they call you"
              />
            </label>

            <div className="mt-auto flex flex-col gap-2">
              {note && <div className="text-sm font-bold text-pa-ink text-center">{note}</div>}
              <button className={btnAccent} onClick={() => void join()} disabled={busy || !name.trim()}>
                {busy ? 'Pairing…' : `Pair with ${from}`}
              </button>
              <button onClick={finish} className="min-h-[44px] text-sm font-bold text-fg/45">Not now</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ title, sub, action, onAction }: { title: string; sub: string; action: string; onAction: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 animate-fade-up">
      <h1 className="font-display text-3xl font-extrabold leading-tight">{title}</h1>
      <p className="text-fg/65 leading-snug">{sub}</p>
      <button className={btnAccent + ' mt-2'} onClick={onAction}>{action}</button>
    </div>
  )
}
