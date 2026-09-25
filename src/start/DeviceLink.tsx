import { useState } from 'react'
import { api, DailyError } from '../daily/api'
import { Wordmark } from '../ui/Logo'
import { Avatar } from '../ui/Avatar'
import { btnAccent } from '../ui/styles'
import { refreshProfile } from '../profile/store'
import { forgetInvite, type InviteLink } from './invite'

// Where a device link lands: "Use this device as Johnny?" One tap and this device is
// them — same couple, same puzzles. Made on the other device, from Profile.
export function DeviceLink({ link, onDone }: { link: InviteLink; onDone: () => void }) {
  const who = link.from || 'you'
  const [step, setStep] = useState<'ask' | 'done' | { error: string }>('ask')
  const [busy, setBusy] = useState(false)
  const finish = () => { forgetInvite(); onDone() }

  const go = async () => {
    setBusy(true)
    try {
      await api.linkDevice(link.code)
      await refreshProfile()
      setStep('done')
    } catch (e) {
      const msg = e instanceof DailyError ? e.message : "Couldn't reach the server — try again."
      setStep({
        error: /didn't work/.test(msg)
          ? 'That link has run out or been used already. Make a new one from Profile on your other device.'
          : /already paired/i.test(msg)
            ? 'This device is already paired as someone. To use it as you, unpair it first from its Profile.'
            : msg,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="min-h-full w-full max-w-md mx-auto px-6 py-10 flex flex-col items-center justify-center text-center gap-6 animate-fade-up">
        <Wordmark className="font-display text-xl font-extrabold" />
        <Avatar p="A" name={link.from || '?'} size="xl" />
        {step === 'ask' ? (
          <>
            <div>
              <h1 className="font-display text-3xl font-extrabold leading-tight">Use this device as {who}?</h1>
              <p className="mt-2 text-fg/65 leading-snug">It’ll have the same couple, puzzles and Memories as your other one.</p>
            </div>
            <button className={btnAccent} onClick={() => void go()} disabled={busy}>{busy ? 'Linking…' : `Yes, I’m ${who}`}</button>
            <button onClick={finish} className="min-h-[44px] text-sm font-bold text-fg/45">Not now</button>
          </>
        ) : step === 'done' ? (
          <>
            <div>
              <h1 className="font-display text-3xl font-extrabold leading-tight">All set</h1>
              <p className="mt-2 text-fg/65 leading-snug">This device is {who} now too.</p>
            </div>
            <button className={btnAccent} onClick={finish}>Let’s go</button>
          </>
        ) : (
          <>
            <div>
              <h1 className="font-display text-3xl font-extrabold leading-tight">That didn’t work</h1>
              <p className="mt-2 text-fg/65 leading-snug">{step.error}</p>
            </div>
            <button className={btnAccent} onClick={finish}>Open the app</button>
          </>
        )}
      </div>
    </div>
  )
}
