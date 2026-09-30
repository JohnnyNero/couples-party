import { useEffect, useRef, useState } from 'react'
import { AccountError, confirmCode, confirmedByLink, providers, sendCode, withGoogle, type Sent } from './account'
import { btnAccent, btnOutline, eyebrow, field } from '../ui/styles'
import { TypingDots } from '../ui/kit'

// Your email, then the code that's sent to it — or Google, once it's switched on. Used
// wherever an account's needed: setting up, accepting an invite, saving a guest account,
// signing back in. `onDone` says whether this made the account you had yours
// ('upgrade') or signed in to one that already existed ('signin').
export function SignIn({ title, sub, onDone, onLater, later = 'Not now' }: {
  title: string
  sub: string
  onDone: (sent: Sent) => void
  onLater?: () => void
  later?: string
}) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<Sent | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [google, setGoogle] = useState(false)
  const [useEmail, setUseEmail] = useState(false)
  const codeBox = useRef<HTMLInputElement>(null)
  useEffect(() => { void providers().then((p) => setGoogle(p.google)) }, [])
  useEffect(() => { if (sent) codeBox.current?.focus() }, [sent])
  // Tapped the link in the email instead: finish as soon as it's gone through.
  useEffect(() => {
    if (!sent) return
    let live = true
    const look = () => { void confirmedByLink(email, sent).then((ok) => { if (ok && live) { live = false; onDone(sent) } }).catch(() => {}) }
    const id = setInterval(look, 3000)
    const back = () => { if (document.visibilityState === 'visible') look() }
    document.addEventListener('visibilitychange', back)
    return () => { live = false; clearInterval(id); document.removeEventListener('visibilitychange', back) }
  }, [sent, email, onDone])

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setNote(null)
    try { await fn() } catch (e) { setNote(e instanceof AccountError ? e.message : 'Something went wrong — try again.') } finally { setBusy(false) }
  }
  const ask = () => run(async () => { setSent(await sendCode(email)); setCode('') })
  const confirm = () => run(async () => { await confirmCode(email, code, sent!); onDone(sent!) })

  return (
    <div className="flex-1 flex flex-col gap-6 animate-fade-up">
      <div className="text-center">
        <h1 className="font-display text-[2.1rem] font-extrabold leading-[1.1]">{sent ? 'Check your email' : title}</h1>
        <p className="mt-2 text-fg/65 leading-snug">
          {sent ? <>We’ve emailed <b className="text-fg">{email.trim()}</b>. Type in the code — or tap the link in the email, then come back here.</> : sub}
        </p>
      </div>

      {!sent ? (
        <>
          {/* Google first when it's on: one tap, and it works for everyone today. Email
              sits behind it until asked for. */}
          {google && (
            <button className={btnAccent + ' inline-flex items-center justify-center gap-3'} onClick={() => void run(withGoogle)} disabled={busy}>
              <span className="w-8 h-8 rounded-full bg-white inline-flex items-center justify-center"><GoogleMark /></span> Continue with Google
            </button>
          )}
          {google && !useEmail ? (
            <button onClick={() => setUseEmail(true)} className="min-h-[44px] text-sm font-bold text-fg/55">Use my email instead</button>
          ) : (
            <>
              {google && <div className="flex items-center gap-3 text-xs font-bold text-fg/40"><span className="flex-1 h-px bg-fg/15" />or<span className="flex-1 h-px bg-fg/15" /></div>}
              <label className="flex flex-col gap-1.5">
                <span className={eyebrow}>Your email</span>
                <input
                  className={field}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && valid) void ask() }}
                  placeholder="you@example.com"
                />
              </label>
              <button className={google ? btnOutline : btnAccent} onClick={() => void ask()} disabled={busy || !valid}>
                {busy ? 'Sending…' : 'Send me a code'}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className={eyebrow}>The code</span>
            <input
              ref={codeBox}
              className={field + ' text-center tracking-[0.35em] tabular-nums'}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onKeyDown={(e) => { if (e.key === 'Enter' && code.length >= 6) void confirm() }}
              placeholder="••••••••"
            />
          </label>
          <button className={btnAccent} onClick={() => void confirm()} disabled={busy || code.length < 6}>
            {busy ? <span className="inline-flex items-center gap-2">Checking<TypingDots /></span> : 'Confirm'}
          </button>
          <div className="flex justify-center gap-5 text-sm font-bold text-fg/55">
            <button className="min-h-[44px]" onClick={() => void ask()} disabled={busy}>Send it again</button>
            <button className="min-h-[44px]" onClick={() => { setSent(null); setCode(''); setNote(null) }} disabled={busy}>Use a different email</button>
          </div>
        </>
      )}

      {note && <div className="text-sm font-bold text-pa-ink text-center" role="alert">{note}</div>}
      <p className="mt-auto text-center text-xs text-fg/45 leading-snug">
        No password to remember. We only use your account to sign you in — never to email you anything else.
      </p>
      {onLater && !sent && <button onClick={onLater} className="-mt-3 min-h-[44px] text-sm font-bold text-fg/45">{later}</button>}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  )
}
