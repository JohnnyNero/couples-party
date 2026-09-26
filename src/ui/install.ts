import { useEffect, useState } from 'react'

// Putting Coupled on the home screen. Android Chrome offers it through its own install
// prompt, which fires once, early — often before React has drawn anything — so it's
// caught here at load and kept until someone taps Install. iPhones have no prompt: there
// it's Share → Add to Home Screen, so the card explains that instead.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPrompt | null = null
let installedNow = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // ours to offer, at a better moment than page load
    deferred = e as InstallPrompt
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installedNow = true
    emit()
  })
}

// Opened from the home screen already (or just installed from here).
export const isInstalled = (): boolean =>
  installedNow ||
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export type Install =
  | { kind: 'installed' }
  | { kind: 'prompt'; install: () => Promise<boolean> } // Android/desktop Chrome: one tap
  | { kind: 'ios' } // Safari: the Share menu
  | { kind: 'none' } // a browser that can't, or hasn't offered yet

export function useInstall(): Install {
  const [, bump] = useState(0)
  useEffect(() => {
    const l = () => bump((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  if (isInstalled()) return { kind: 'installed' }
  if (deferred) {
    const prompt = deferred
    return {
      kind: 'prompt',
      install: async () => {
        await prompt.prompt()
        const { outcome } = await prompt.userChoice
        deferred = null
        if (outcome === 'accepted') installedNow = true
        emit()
        return outcome === 'accepted'
      },
    }
  }
  return isIOS() ? { kind: 'ios' } : { kind: 'none' }
}

// The service worker (public/sw.js): the installed app's instant, offline-tolerant open.
// Production only — in development it would serve yesterday's code.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {})
  })
}
