import { canBuzz, useHaptics } from '../ui/haptics'

// A settings row with a switch: the little buzzes (see ui/haptics). Only where the phone
// can buzz at all — an iPhone gets no row, rather than a switch that does nothing.
export function HapticsRow() {
  const [on, set] = useHaptics()
  if (!canBuzz()) return null
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => set(!on)}
      className="w-full min-h-[56px] flex items-center gap-3 rounded-2xl border-2 border-fg/15 bg-card px-4 text-left press"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-fg/60" aria-hidden="true">
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M3 8v8M21 8v8" />
      </svg>
      <span className="flex-1 font-bold">Vibration</span>
      <span className={'relative w-12 h-7 rounded-full transition-colors ' + (on ? 'bg-pa' : 'bg-fg/20')}>
        <span className={'absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ' + (on ? 'left-6' : 'left-1')} />
      </span>
    </button>
  )
}
