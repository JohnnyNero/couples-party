import { useEffect, useState } from 'react'

// Day / night. With nothing chosen ("Auto") the app follows the phone's own dark-mode
// setting; picking one pins it on this device. index.html applies the stored choice
// before first paint so there's no flash of the wrong one. The choice lives on the
// profile page (ThemeChoice); this module also keeps the phone's status bar in step.

export type Theme = 'day' | 'night'
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

function apply(t: Theme | null) {
  if (t) document.documentElement.dataset.theme = t
  else delete document.documentElement.dataset.theme
  // The browser's own chrome (the status bar tint on phones) follows along.
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().split(/\s+/).join(',')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${bg})`)
}

// Keeps the status bar right from the first render, and follows the phone switching over
// at sunset — unless someone has pinned a choice. Mounted once, at the app's root.
export function useThemeSync() {
  useEffect(() => {
    apply(stored())
    const m = media()
    const onChange = () => { if (!stored()) apply(null) }
    m?.addEventListener?.('change', onChange)
    return () => m?.removeEventListener?.('change', onChange)
  }, [])
}

// Day, Night or Auto, as three segments.
export function ThemeChoice() {
  const [choice, setChoice] = useState<Theme | null>(stored)
  const pick = (t: Theme | null) => {
    try {
      if (t) localStorage.setItem(KEY, t)
      else localStorage.removeItem(KEY)
    } catch { /* private mode — lasts this visit */ }
    apply(t)
    setChoice(t)
  }
  const opts: [Theme | null, string][] = [['day', 'Day'], ['night', 'Night'], [null, 'Auto']]
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-2xl bg-fg/[0.06] p-1">
      {opts.map(([t, label]) => (
        <button
          key={label}
          role="radio"
          aria-checked={choice === t}
          onClick={() => pick(t)}
          className={
            'min-h-[44px] rounded-xl font-display text-base font-extrabold transition-colors ' +
            (choice === t ? 'bg-card text-fg shadow-[0_1px_0_rgba(0,0,0,0.12)] border-2 border-fg' : 'text-fg/55')
          }
        >
          {label}
        </button>
      ))}
    </div>
  )
}
