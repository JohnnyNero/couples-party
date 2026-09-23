import { useEffect, useState } from 'react'

// Day / night. With nothing chosen the app follows the phone's own dark-mode setting;
// tapping this pins one or the other on this device. index.html applies the stored
// choice before first paint so there's no flash of the wrong one.

type Theme = 'day' | 'night'
const KEY = 'couples-party:theme'
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)')

function stored(): Theme | null {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'day' || t === 'night' ? t : null
  } catch {
    return null
  }
}

function effective(): Theme {
  return stored() ?? (media()?.matches ? 'night' : 'day')
}

function apply(t: Theme | null) {
  if (t) document.documentElement.dataset.theme = t
  else delete document.documentElement.dataset.theme
  // The browser's own chrome (the status bar tint on phones) follows along.
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().split(/\s+/).join(',')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${bg})`)
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(effective)

  useEffect(() => {
    apply(stored())
    // Follow the phone switching over at sunset — unless someone has pinned a choice.
    const m = media()
    const onChange = () => { if (!stored()) { apply(null); setTheme(effective()) } }
    m?.addEventListener?.('change', onChange)
    return () => m?.removeEventListener?.('change', onChange)
  }, [])

  const flip = () => {
    const next: Theme = theme === 'night' ? 'day' : 'night'
    try { localStorage.setItem(KEY, next) } catch { /* private mode — lasts this visit */ }
    apply(next)
    setTheme(next)
  }

  return (
    <button
      onClick={flip}
      aria-label={theme === 'night' ? 'Switch to day mode' : 'Switch to night mode'}
      className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-fg/15 text-fg/60 active:translate-y-px"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === 'night' ? (
          <>
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" />
          </>
        ) : (
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
        )}
      </svg>
    </button>
  )
}
