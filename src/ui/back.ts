import { useEffect, useRef } from 'react'

// Back — the phone's gesture, the browser's button — moves back through the app instead
// of leaving it. Every screen that opens over another (a puzzle, the profile, a tab, a
// game) holds a history entry while it's open, and back closes whichever opened last.
//
// Each of our entries is marked with how many screens were open at it (`coupledDepth`),
// so landing on one says exactly what should still be open. Closing a screen in the app
// (its own ← button, finishing it) hands its entry back — all together, a moment later,
// which also covers one screen closing as another opens in the same breath.
//
// Something else can add an entry too: Playroom writes the room code into the address
// (`#r=…`) as a game starts, and that lands exactly like a press of back. An entry that
// isn't ours is stepped straight back off — keeping the new address — so it never closes
// anything, and back still means back.

type Layer = { close: () => void }
type Marked = { coupledDepth?: number } | null

const stack: Layer[] = []
let ignore = 0 // popstates we caused ourselves
let owed = 0 // entries to hand back
let listening = false
let leavingTo: string | null = null // see leaveTo
let keepUrl: string | null = null // an address to keep after stepping off a foreign entry

const depthOf = (state: unknown) => (state as Marked)?.coupledDepth

function listen() {
  if (listening) return
  listening = true
  // The entry the app opened on is depth 0.
  if (depthOf(window.history.state) === undefined) {
    window.history.replaceState({ ...(window.history.state ?? {}), coupledDepth: 0 }, '')
  }
  window.addEventListener('popstate', (e) => {
    if (ignore > 0) {
      ignore -= 1
      if (ignore > 0) return
      if (leavingTo) {
        window.location.replace(leavingTo)
      } else if (keepUrl) {
        window.history.replaceState(window.history.state, '', keepUrl)
        keepUrl = null
      }
      return
    }
    const depth = depthOf(e.state)
    if (depth === undefined) {
      keepUrl = window.location.href
      ignore += 1
      window.history.back()
      return
    }
    while (stack.length > depth) stack.pop()!.close()
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
    window.history.pushState({ coupledDepth: stack.length }, '')
    return () => {
      const i = stack.indexOf(layer)
      if (i < 0) return // closed by back: its entry is already gone
      stack.splice(i, 1)
      owed += 1
      queueMicrotask(handBack)
    }
  }, [open])
}

// Changing the address in place (e.g. writing the game into it) without losing the mark
// that says how deep this entry is.
export function replaceUrl(url: string): void {
  window.history.replaceState(window.history.state, '', url)
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
