// The app always fills what you can actually see — so with the keyboard up, the game's
// header (and its clock) stays on screen instead of scrolling away above it.
//
// Android Chrome is told to shrink the page for the keyboard (interactive-widget in
// index.html), which does this by itself. Browsers that don't (iOS Safari, older
// Chromes) shrink only the "visual viewport" and pan the page under it; for them the app
// is pinned to that visible area instead (--vv-top/--vv-h, used by #root in index.css).
// Either way, whatever box you're typing in is then scrolled back into view.
export function fitToVisibleViewport(): void {
  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement
  const fit = () => {
    root.style.setProperty('--vv-h', `${vv.height}px`)
    root.style.setProperty('--vv-top', `${vv.offsetTop}px`)
  }
  const reveal = () => {
    const el = document.activeElement as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest' }))
    }
  }
  vv.addEventListener('resize', () => { fit(); reveal() })
  vv.addEventListener('scroll', fit)
  fit()
}
