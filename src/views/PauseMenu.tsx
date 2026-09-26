import { useState } from 'react'
import type { SessionState } from '../engine/state'
import { other } from '../engine/state'
import { canPause } from '../engine/reducer'
import { dispatch, useMyPlayerId } from '../net'
import { ThemeChoice } from './ThemeToggle'
import { FullscreenRow } from './FullscreenToggle'
import { playerName } from './list'
import { Avatar } from '../ui/Avatar'
import { btnAccent, eyebrow } from '../ui/styles'
import { leaveTo } from '../ui/back'

// The button at the top right of every game screen. Mid-game it pauses the game for
// both of you — the clock stops and the menu comes up on both phones (and the TV). At a
// moment that can't be paused (the lobby, Stop the Clock's run) it just opens the menu
// on this phone.
export function PauseButton({ s, onOpenLocal }: { s: SessionState; onOpenLocal: () => void }) {
  const me = useMyPlayerId()
  if (!me) return null
  const pausable = canPause(s)
  return (
    <button
      onClick={() => (pausable ? dispatch({ type: 'PAUSE', player: me }) : onOpenLocal())}
      aria-label={pausable ? 'Pause' : 'Menu'}
      className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-fg/70 active:translate-y-px"
    >
      {pausable ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg>
      )}
    </button>
  )
}

// Paused (for everyone), or just this phone's menu. Resume, the settings, and leaving.
export function PauseMenu({ s, localOpen, onCloseLocal }: { s: SessionState; localOpen: boolean; onCloseLocal: () => void }) {
  const me = useMyPlayerId()
  const [leaving, setLeaving] = useState(false)
  if (!s.paused && !localOpen) return null
  if (s.paused?.away) return null // that's the waiting screen, not this menu
  const by = s.paused?.by
  const resume = () => (s.paused && me ? dispatch({ type: 'RESUME', player: me }) : onCloseLocal())
  const leave = () => leaveTo(window.location.pathname)

  return (
    <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-md flex items-center justify-center p-5 animate-fade-up" role="dialog" aria-modal="true" aria-label={s.paused ? 'Paused' : 'Menu'}>
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div className="text-center">
          {by && (
            <div className="flex justify-center mb-2">
              <Avatar p={by} name={playerName(s, by)} size="md" />
            </div>
          )}
          <h1 className="font-display text-4xl font-extrabold leading-tight">{s.paused ? 'Paused' : 'Menu'}</h1>
          <div className="text-sm text-fg/60">
            {!s.paused ? 'The game carries on while this is open.' : by === me ? 'The clock’s stopped for both of you.' : `${playerName(s, by!)} paused the game.`}
          </div>
        </div>

        {me && (
          <button className={btnAccent + ' min-h-[60px] text-2xl'} onClick={resume}>
            {s.paused ? 'Resume' : 'Back to the game'}
          </button>
        )}

        {me && (
          <section className="flex flex-col gap-2">
            <div className={eyebrow}>Settings</div>
            <FullscreenRow />
            <ThemeChoice />
          </section>
        )}

        {me && (
          leaving ? (
            <section className="rounded-3xl border-2 border-pa bg-pa-soft px-4 py-4 flex flex-col gap-3">
              <div className="font-display text-lg font-extrabold leading-tight">Leave this game?</div>
              <div className="text-sm text-fg/75 leading-snug">
                You’ll go back to the home screen. {playerName(s, other(me))} can leave from their menu too.
              </div>
              <div className="flex gap-2">
                <button onClick={() => setLeaving(false)} className="flex-1 min-h-[48px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px">Stay</button>
                <button onClick={leave} className="flex-1 min-h-[48px] rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px">Leave</button>
              </div>
            </section>
          ) : (
            <button onClick={() => setLeaving(true)} className="self-center min-h-[44px] px-5 font-bold text-fg/55 active:translate-y-px">
              Leave game
            </button>
          )
        )}
      </div>
    </div>
  )
}
