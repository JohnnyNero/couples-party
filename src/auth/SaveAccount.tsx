import { useProfile } from '../profile/store'
import { openWelcome } from '../onboard/flags'
import { useAccount } from './account'

// On Today for anyone still playing as a guest once they're paired (or waiting for their
// partner): their account lives only on this phone until it has an email, and a cleared
// browser or a new phone would lose the lot.
export function SaveAccount() {
  const account = useAccount()
  const profile = useProfile()
  if (account.kind !== 'guest' || !profile || profile.state === 'single') return null
  return (
    <section className="rounded-[1.75rem] border-2 border-pa bg-pa-soft p-4 flex flex-col gap-3 animate-fade-up">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-10 h-10 rounded-xl bg-pa text-white inline-flex items-center justify-center" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></svg>
        </span>
        <div className="min-w-0">
          <div className="font-display text-lg font-extrabold leading-tight text-pa-ink">Save your account</div>
          <div className="text-sm text-fg/70 leading-snug">
            Right now it only lives on this phone. Add your email so you never lose your puzzles, streak and Memories — and can sign in anywhere.
          </div>
        </div>
      </div>
      <button onClick={() => openWelcome('save')} className="min-h-[48px] rounded-2xl bg-pa text-white font-display text-lg font-extrabold press">
        Add my email
      </button>
    </section>
  )
}
