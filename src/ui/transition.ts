import { flushSync } from 'react-dom'

// Screen transitions. The browser's own view transitions do the work: it snapshots the
// screen, React swaps in the new one, and the two are animated across each other — so
// the old screen can leave as well as the new one arrive, with nothing kept mounted by
// hand. The keyframes are in index.css, one pair per direction:
//
//   forward — a page opening over this one pushes in from the right
//   back    — and slides away to the right again, uncovering where you were
//   left / right — Home's tabs, sliding towards the tab you tapped (the bar stays put)
//   deal    — the next screen of a game, dealt in like a card (the header stays put)
//
// Where the browser can't (or you've asked your phone for less motion), the change just
// happens, and each screen's own fade-in is all there is.
export type Slide = 'forward' | 'back' | 'left' | 'right' | 'deal'

type WithTransitions = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void>; ready: Promise<void>; skipTransition: () => void }
}

export const canSlide = (): boolean =>
  typeof document !== 'undefined' &&
  !!(document as WithTransitions).startViewTransition &&
  !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

let current = 0

export function slide(direction: Slide, update: () => void): void {
  const doc = document as WithTransitions
  if (!canSlide()) {
    update()
    return
  }
  const root = document.documentElement
  const mine = ++current
  root.dataset.slide = direction
  try {
    const t = doc.startViewTransition!(() => flushSync(update))
    // A transition cut short by the next one rejects `ready`; that's expected, not an error.
    t.ready.catch(() => {})
    t.finished.catch(() => {}).finally(() => { if (current === mine) delete root.dataset.slide })
  } catch {
    // A transition already running can refuse a second one: just make the change.
    delete root.dataset.slide
    update()
  }
}
