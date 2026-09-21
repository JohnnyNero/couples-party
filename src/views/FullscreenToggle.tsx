import { useEffect, useState } from 'react'

// A phone in a couple's hands spends the whole session catching the browser's own
// chrome (address bar, home indicator) in its peripheral vision — this hides it.
// Fixed in one corner, on every screen, so it works before a game mode is even picked.
export function FullscreenToggle() {
  const [isFull, setIsFull] = useState(() => !!document.fullscreenElement)

  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Some mobile browsers (notably iOS Safari) don't implement the Fullscreen API at
  // all — rather than show a button that silently does nothing, this hides itself.
  if (typeof document.documentElement.requestFullscreen !== 'function') return null

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }

  return (
    <button
      onClick={toggle}
      aria-label={isFull ? 'Exit full screen' : 'Enter full screen'}
      className="fixed top-2 right-2 z-30 h-9 w-9 flex items-center justify-center bg-bg/80 border-2 border-fg/20 text-fg/50 active:translate-y-px"
    >
      {isFull ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      )}
    </button>
  )
}
