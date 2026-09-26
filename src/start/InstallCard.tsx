import { useState } from 'react'
import { useInstall } from '../ui/install'
import { Logo } from '../ui/Logo'
import { btnAccent } from '../ui/styles'

// "Put Coupled on your home screen" — on Today until it's done, or put off. "Not now"
// puts it away for a fortnight on this phone. On Android it's one tap; on an iPhone it
// walks you through the Share menu.
const LATER_KEY = 'coupled:install-later'
const FORTNIGHT = 14 * 24 * 60 * 60 * 1000

function putOff(): boolean {
  try { return Date.now() - Number(localStorage.getItem(LATER_KEY) ?? 0) < FORTNIGHT } catch { return false }
}

export function InstallCard() {
  const install = useInstall()
  const [later, setLater] = useState(putOff)
  const [steps, setSteps] = useState(false)
  if (later || (install.kind !== 'prompt' && install.kind !== 'ios')) return null
  const notNow = () => {
    try { localStorage.setItem(LATER_KEY, String(Date.now())) } catch { /* just this visit */ }
    setLater(true)
  }
  return (
    <section className="rounded-[1.75rem] border-2 border-fg bg-card p-4 flex flex-col gap-3 shadow-[4px_4px_0_rgba(0,0,0,0.12)] animate-fade-up">
      <div className="flex items-center gap-3">
        <span className="shrink-0 w-14 h-14 rounded-2xl bg-bg border-2 border-fg/10 inline-flex items-center justify-center">
          <Logo className="w-10" link="once" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-extrabold leading-tight">Put Coupled on your home screen</div>
          <div className="text-sm text-fg/60">It opens like an app — full screen, and straight in.</div>
        </div>
      </div>
      {steps && <IosSteps />}
      <div className="flex gap-2">
        <button onClick={notNow} className="press flex-1 min-h-[48px] rounded-2xl border-2 border-fg/15 font-display text-lg font-extrabold text-fg/60">Not now</button>
        {install.kind === 'prompt' ? (
          <button onClick={() => void install.install()} className={btnAccent + ' flex-[2] !min-h-[48px] !text-lg'}>Install</button>
        ) : (
          !steps && <button onClick={() => setSteps(true)} className={btnAccent + ' flex-[2] !min-h-[48px] !text-lg'}>Show me how</button>
        )}
      </div>
    </section>
  )
}

// Safari's way: Share, then Add to Home Screen.
export function IosSteps() {
  const share = (
    <svg viewBox="0 0 24 24" className="inline w-5 h-5 -mt-1 text-pb-ink" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8" />
    </svg>
  )
  return (
    <ol className="flex flex-col gap-2 text-sm font-bold">
      <li className="flex items-center gap-2.5"><Num n={1} /><span>In Safari, tap Share {share}</span></li>
      <li className="flex items-center gap-2.5"><Num n={2} /><span>Scroll down and tap <b>Add to Home Screen</b></span></li>
      <li className="flex items-center gap-2.5"><Num n={3} /><span>Tap <b>Add</b> — then open Coupled from its icon</span></li>
    </ol>
  )
}

function Num({ n }: { n: number }) {
  return <span className="shrink-0 w-6 h-6 rounded-full bg-pa-soft text-pa-ink font-display font-extrabold text-xs inline-flex items-center justify-center">{n}</span>
}

// The same, as a settings row on the profile page — there whenever it isn't installed,
// even after "Not now".
export function InstallRow() {
  const install = useInstall()
  const [steps, setSteps] = useState(false)
  if (install.kind !== 'prompt' && install.kind !== 'ios') return null
  return (
    <div className="rounded-2xl border-2 border-fg/15 bg-card">
      <button
        onClick={() => (install.kind === 'prompt' ? void install.install() : setSteps((v) => !v))}
        className="press w-full min-h-[56px] flex items-center gap-3 px-4 text-left"
      >
        <Logo className="w-6 shrink-0" />
        <span className="flex-1 font-bold">Add to home screen</span>
        <span className="text-sm font-extrabold text-accent-ink">{install.kind === 'prompt' ? 'Install' : steps ? 'Hide' : 'How'}</span>
      </button>
      {steps && <div className="px-4 pb-4"><IosSteps /></div>}
    </div>
  )
}
