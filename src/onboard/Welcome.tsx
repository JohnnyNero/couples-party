import { useEffect, useRef, useState } from 'react'
import { api, DailyError, enterCode } from '../daily/api'
import { refreshProfile, useProfile } from '../profile/store'
import { shrinkPhoto } from '../profile/photo'
import { inviteUrl } from '../start/invite'
import { Avatar } from '../ui/Avatar'
import { Wordmark } from '../ui/Logo'
import { TypingDots } from '../ui/kit'
import { Burst, at } from '../ui/fx'
import { btnAccent, btnOutline, eyebrow, field } from '../ui/styles'
import { useBackLayer } from '../ui/back'
import { markWelcomed, type WelcomeStart } from './flags'
import { Tour } from './Tour'

// A new phone's way in: how Coupled works (the tour), who you are, then getting your
// partner here — a link they tap, or a code they type — and waiting with you until they
// arrive. Someone who already has a code from their partner goes that way instead.
// "Later" at any point just drops you on Home, where Today picks up where you left off.

const NAME_KEY = 'couples-party:name'
const savedName = () => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } }
const saveName = (n: string) => { try { localStorage.setItem(NAME_KEY, n) } catch { /* private mode */ } }

type Step = 'tour' | 'you' | 'code' | 'invite' | 'paired'

export function Welcome({ start, onClose }: { start: WelcomeStart; onClose: () => void }) {
  const profile = useProfile()
  // Already waiting for a partner (set up earlier, then closed): straight to the invite.
  const initial: Step = start === 'tour' || start === 'tour-only' ? 'tour' : profile?.state === 'waiting' && start === 'you' ? 'invite' : start
  const [step, setStep] = useState<Step>(initial)
  const [name, setName] = useState(() => (profile && profile.state !== 'single' ? profile.me.name : savedName()))
  const [photo, setPhoto] = useState<string | null>(null)
  const done = () => { markWelcomed(); onClose() }
  useBackLayer(true, done)

  return (
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
      <div className="min-h-full w-full max-w-md mx-auto px-6 pt-5 pb-8 flex flex-col">
        {step === 'tour' ? (
          <div className="flex-1 flex flex-col min-h-[36rem]">
            <Tour
              onDone={() => (start === 'tour-only' ? done() : (markWelcomed(), setStep('you')))}
              onSkip={start === 'tour-only' ? done : () => { markWelcomed(); setStep('you') }}
              last={start === 'tour-only' ? 'Got it' : 'Set us up'}
            />
          </div>
        ) : step === 'you' ? (
          <You
            name={name}
            setName={setName}
            photo={photo}
            setPhoto={setPhoto}
            onMade={() => setStep('invite')}
            onCode={() => setStep('code')}
            onLater={done}
          />
        ) : step === 'code' ? (
          <Code name={name} setName={setName} onBack={() => setStep('you')} onPaired={() => setStep('paired')} onDevice={done} />
        ) : step === 'invite' ? (
          <Invite name={name} onPaired={() => setStep('paired')} onLater={done} />
        ) : (
          <Paired onGo={done} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- who are you

function You({ name, setName, photo, setPhoto, onMade, onCode, onLater }: {
  name: string
  setName: (n: string) => void
  photo: string | null
  setPhoto: (p: string | null) => void
  onMade: () => void
  onCode: () => void
  onLater: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const pick = (file: File | undefined) => {
    if (!file) return
    shrinkPhoto(file).then(setPhoto).catch(() => setNote("Couldn't use that photo — try another."))
  }
  const make = async () => {
    const n = name.trim()
    if (!n) return setNote('Your name first.')
    saveName(n)
    setBusy(true)
    setNote(null)
    try {
      await api.createCouple(n)
    } catch (e) {
      setBusy(false)
      return setNote(e instanceof DailyError ? e.message : "Couldn't reach the server — try again.")
    }
    // The photo's a nice-to-have: if it doesn't go through, it can be added later.
    if (photo) await api.setPhoto(photo).catch(() => {})
    await refreshProfile()
    setBusy(false)
    onMade()
  }
  return (
    <div className="flex-1 flex flex-col gap-7 animate-fade-up">
      <div className="text-center">
        <Wordmark className="font-display text-xl font-extrabold" />
        <h1 className="mt-3 font-display text-[2.1rem] font-extrabold leading-[1.1]">First, who are you?</h1>
        <p className="mt-2 text-fg/65 leading-snug">This is how you’ll show up to your partner, in every game.</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <button onClick={() => picker.current?.click()} aria-label={photo ? 'Change photo' : 'Add a photo'} className="relative rounded-full press">
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
          onKeyDown={(e) => { if (e.key === 'Enter') void make() }}
          maxLength={24}
          autoComplete="given-name"
          placeholder="What they call you"
        />
      </label>
      <div className="mt-auto flex flex-col gap-2">
        {note && <div className="text-sm font-bold text-pa-ink text-center">{note}</div>}
        <button className={btnAccent} onClick={() => void make()} disabled={busy || !name.trim()}>
          {busy ? 'Setting up…' : 'Next: invite your partner'}
        </button>
        <button className={btnOutline} onClick={onCode} disabled={busy}>
          My partner sent me a code
        </button>
        <button onClick={onLater} className="min-h-[44px] text-sm font-bold text-fg/45">I’ll do this later</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- got a code

function Code({ name, setName, onBack, onPaired, onDevice }: {
  name: string
  setName: (n: string) => void
  onBack: () => void
  onPaired: () => void
  onDevice: () => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const join = async () => {
    const n = name.trim()
    if (!n) return setNote('Your name first.')
    saveName(n)
    setBusy(true)
    setNote(null)
    try {
      const how = await enterCode(code, n)
      await refreshProfile()
      setBusy(false)
      if (how === 'device') onDevice()
      else onPaired()
    } catch (e) {
      setBusy(false)
      setNote(e instanceof DailyError ? e.message : "Couldn't reach the server — try again.")
    }
  }
  return (
    <div className="flex-1 flex flex-col gap-6 animate-fade-up">
      <div className="text-center">
        <Wordmark className="font-display text-xl font-extrabold" />
        <h1 className="mt-3 font-display text-[2.1rem] font-extrabold leading-[1.1]">Got a code?</h1>
        <p className="mt-2 text-fg/65 leading-snug">
          Your partner’s six-letter code pairs you up. (Tapping the link they sent you does the same, with no typing.)
        </p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={eyebrow}>Your name</span>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name" placeholder="What they call you" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={eyebrow}>The code</span>
        <input
          className={field + ' uppercase tracking-[0.4em] text-center'}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) void join() }}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABC234"
        />
      </label>
      <div className="mt-auto flex flex-col gap-2">
        {note && <div className="text-sm font-bold text-pa-ink text-center">{note}</div>}
        <button className={btnAccent} onClick={() => void join()} disabled={busy || code.length !== 6 || !name.trim()}>
          {busy ? 'Pairing…' : 'Pair us up'}
        </button>
        <button onClick={onBack} className="min-h-[44px] text-sm font-bold text-fg/45">Back</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- invite them

// The link opens Coupled on their phone and pairs them in one tap; the code is there for
// typing in if a link won't do. This waits with you, and moves on the moment they're in.
function Invite({ name, onPaired, onLater }: { name: string; onPaired: () => void; onLater: () => void }) {
  const profile = useProfile()
  const code = profile?.state === 'waiting' ? profile.code : null
  const me = profile && profile.state !== 'single' ? profile.me.name : name
  const [note, setNote] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (profile?.state === 'paired') onPaired()
  }, [profile?.state, onPaired])
  // Checking for them every few seconds, while this is on screen.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') void refreshProfile() }, 3000)
    const back = () => { if (document.visibilityState === 'visible') void refreshProfile() }
    document.addEventListener('visibilitychange', back)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', back) }
  }, [])

  const share = async () => {
    if (!code) return
    const url = inviteUrl(code, me)
    const text = `${me ? `${me} has` : 'I’ve'} invited you to Coupled — little games for the two of us. Tap to pair up with me:`
    setNote(null)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Coupled', text, url })
        setSent(true)
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setSent(true)
      setNote('Link copied — paste it to them.')
    } catch {
      setNote(url)
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-6 animate-fade-up">
      <div className="flex justify-center pt-4">
        <div className="flex items-center">
          <Avatar p="A" name={me || '?'} size="xl" className="ring-4 ring-bg z-10" />
          <span className="-ml-5 w-24 h-24 rounded-full border-[3px] border-dashed border-pb/60 bg-pb-soft inline-flex items-center justify-center font-display text-5xl font-extrabold text-pb-ink animate-breathe">?</span>
        </div>
      </div>
      <div className="text-center">
        <h1 className="font-display text-[2.1rem] font-extrabold leading-[1.1]">Now invite your partner</h1>
        <p className="mt-2 text-fg/65 leading-snug">
          Coupled is for two. Send them the link — it opens Coupled on their phone and pairs you up in one tap.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <button className={btnAccent} onClick={() => void share()} disabled={!code}>
          {sent ? 'Send it again' : 'Send the invite link'}
        </button>
        <div className="min-h-[1.25rem] text-center text-sm font-bold text-fg/55 break-all">{note ?? ''}</div>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-sm text-fg/55">Or they can open Coupled, tap <b>My partner sent me a code</b>, and type</div>
        <div className="rounded-2xl border-2 border-fg bg-card px-5 py-2 font-display text-4xl font-extrabold tracking-[0.18em] text-pa-ink tabular-nums shadow-[4px_4px_0_rgba(0,0,0,0.12)]">
          {code ?? '······'}
        </div>
      </div>
      <div className="mt-auto flex flex-col items-center gap-1">
        <div className="text-sm font-bold text-fg/50 inline-flex items-center gap-1.5">Waiting for them to join<TypingDots /></div>
        <button onClick={onLater} className="min-h-[44px] text-sm font-bold text-fg/45">I’ll wait on the home screen</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- paired!

function Paired({ onGo }: { onGo: () => void }) {
  const profile = useProfile()
  const pair = profile?.state === 'paired' ? profile : null
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 animate-fade-up">
      <div className="relative flex">
        <span className="animate-nudge-r" style={at(100)}><Avatar p="A" name={pair?.me.name ?? '?'} size="xl" className="ring-4 ring-bg" /></span>
        <span className="-ml-5 animate-nudge-l" style={at(100)}><Avatar p="B" name={pair?.partner.name ?? '?'} size="xl" className="ring-4 ring-bg" /></span>
        <Burst hearts delay={350} count={20} />
      </div>
      <div>
        <h1 className="font-display text-4xl font-extrabold leading-tight animate-slam" style={at(300)}>
          {pair ? `You’re paired with ${pair.partner.name}!` : 'You’re paired!'}
        </h1>
        <p className="mt-3 text-fg/65 leading-snug">
          Start with today’s puzzles — or, if you’re together, play today’s games. The list on your home screen shows you the way.
        </p>
      </div>
      <button className={btnAccent} onClick={onGo}>Let’s go</button>
    </div>
  )
}
