import { useEffect, useState } from 'react'

// Full screen hides the browser's own chrome (address bar, home indicator) for a whole
// session. It lives in the pause menu during a game, and on the profile page otherwise.
// Some mobile browsers (notably iOS Safari) don't implement the Fullscreen API at all —
// there the row just isn't shown, rather than being a switch that does nothing.

export const canFullscreen = () => typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function'

export function useFullscreen(): [boolean, () => void] {
  const [isFull, setIsFull] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement)
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }
  return [isFull, toggle]
}

// A settings row with a switch.
export function FullscreenRow() {
  const [isFull, toggle] = useFullscreen()
  if (!canFullscreen()) return null
  return (
    <button
      role="switch"
      aria-checked={isFull}
      onClick={toggle}
      className="w-full min-h-[56px] flex items-center gap-3 rounded-2xl border-2 border-fg/15 bg-card px-4 text-left active:translate-y-px"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-fg/60" aria-hidden="true">
        <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
      </svg>
      <span className="flex-1 font-bold">Full screen</span>
      <span className={'relative w-12 h-7 rounded-full transition-colors ' + (isFull ? 'bg-pa' : 'bg-fg/20')}>
        <span className={'absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ' + (isFull ? 'left-6' : 'left-1')} />
      </span>
    </button>
  )
}
