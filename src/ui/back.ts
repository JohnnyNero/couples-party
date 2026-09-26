import { useEffect, useRef } from 'react'

// Back — the phone's gesture, the browser's button — moves back through the app instead
// of leaving it. Every screen that opens over another (a puzzle, the profile, a tab, a
// game) holds a history entry while it's open, and back closes whichever opened last.
//
// Closing one in the app (its own ← button, finishing it) hands its entry back, so the
// history never fills up with dead entries. Those are all handed back together, a moment
// later, which also covers one screen closing as another opens in the same breath.

type Layer = { close: () => void }

const stack: Layer[] = []
let ignore = 0 // popstates we caused ourselves, handing entries back
let owed = 0 // entries to hand back
let listening = false
let leavingTo: string | null = null // see leaveTo

function listen() {
  if (listening) return
  listening = true
  window.addEventListener('popstate', () => {
    if (ignore > 0) {
      ignore -= 1
      if (ignore === 0 && leavingTo) window.location.replace(leavingTo)
      return
    }
    stack.pop()?.close()
  })
}

function handBack() {
  if (owed === 0) return
  const n = owed
  owed = 0
  ignore += 1
  window.history.go(-n)
}

// While `open`, back calls `close` (which should make `open` false).
export function useBackLayer(open: boolean, close: () => void): void {
  const latest = useRef(close)
  latest.current = close
  useEffect(() => {
    if (!open) return
    listen()
    const layer: Layer = { close: () => latest.current() }
    stack.push(layer)
    window.history.pushState(window.history.state, '')
    return () => {
      const i = stack.indexOf(layer)
      if (i < 0) return // closed by back: its entry is already gone
      stack.splice(i, 1)
      owed += 1
      queueMicrotask(handBack)
    }
  }, [open])
}

// Leaving the whole thing (a game, for Home): unwind every entry first, so back from
// where you land doesn't walk you back into it.
export function leaveTo(url: string): void {
  const n = stack.length + owed
  stack.length = 0
  owed = 0
  if (n === 0) {
    window.location.replace(url)
    return
  }
  leavingTo = url
  ignore += 1
  window.history.go(-n)
}
