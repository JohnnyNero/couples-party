import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearSaved } from '../store/progress'

// Whatever goes wrong, never a blank page. The whole app sits inside one of these, and
// parts that read saved data sit in their own (with `quiet`, so they just vanish).
export class ErrorBoundary extends Component<{ children: ReactNode; quiet?: boolean }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Coupled crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    if (this.props.quiet) return null
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="font-display text-3xl font-extrabold leading-tight">Something went wrong</div>
        <div className="text-fg/60 max-w-xs">Sorry about that. Reloading usually sorts it. If it keeps happening, clear the saved game.</div>
        <button
          className="min-h-[52px] px-8 rounded-2xl bg-pa text-white font-display text-lg font-extrabold press"
          onClick={() => window.location.replace(window.location.pathname)}
        >
          Reload
        </button>
        <button
          className="min-h-[44px] px-6 text-sm font-extrabold text-fg/55"
          onClick={() => { clearSaved(); window.location.replace(window.location.pathname) }}
        >
          Clear the saved game and reload
        </button>
      </div>
    )
  }
}
