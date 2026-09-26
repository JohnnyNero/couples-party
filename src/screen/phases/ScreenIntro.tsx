import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { GAME_LABELS } from '../../engine/roster'
import { dispatch, useMyPlayerId } from '../../net'
import { GameGlyph } from '../../ui/GameIcon'
import { card, btnPrimary } from '../../ui/styles'
import { fillOf, inkOf } from '../../ui/Avatar'
import { introSteps, gameNumber, introSub } from '../../views/intro'
import { playerName } from '../../views/list'

// A game's title card: the big icon, its name, and how it plays in three steps. Moves on
// when you're both ready, or by itself (the header's bar shows how long it'll wait).
export function ScreenIntro({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const intro = s.intro!
  const key = intro.key as Exclude<typeof intro.key, 'lights'>
  const num = gameNumber(s, key)
  const filler = key === 'circle' || key === 'clock'
  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5">
      <div className="flex flex-col items-center text-center gap-3">
        <span className="px-3 py-1 rounded-full bg-fg text-bg text-xs font-extrabold tracking-wide">
          {filler ? 'A quick one' : num ? `Game ${num.n} of ${num.of}` : 'How to play'}
        </span>
        <span className="mt-1 w-28 h-28 sm:w-36 sm:h-36 rounded-[2.25rem] bg-card border-[3px] border-fg shadow-[6px_6px_0_rgb(var(--pa))] inline-flex items-center justify-center animate-pop">
          <GameGlyph game={key} className="w-16 h-16 sm:w-20 sm:h-20" />
        </span>
        <h2 className="mt-2 font-display text-[2.6rem] sm:text-6xl font-extrabold leading-none tracking-tight">{GAME_LABELS[key]}</h2>
        <p className="text-base sm:text-xl text-fg/70">{introSub(s, key)}</p>
      </div>

      <ol className={card + ' px-4 py-4 flex flex-col gap-3'}>
        {introSteps(s, key).map((step, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="shrink-0 w-7 h-7 rounded-full bg-pa-soft text-pa-ink font-display font-extrabold text-sm inline-flex items-center justify-center">{i + 1}</span>
            <span className="text-sm sm:text-lg leading-snug pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <div className="flex justify-center gap-5 text-xs sm:text-base font-extrabold">
        {(['A', 'B'] as PlayerId[]).map((p) => (
          <span key={p} className={'flex items-center gap-1.5 ' + (intro.ready[p] ? inkOf(p) : 'text-fg/45')}>
            <span className={'w-2.5 h-2.5 rounded-full ' + (intro.ready[p] ? fillOf(p) : 'border-2 border-fg/30')} />
            {playerName(s, p)} {intro.ready[p] ? 'is ready' : 'is reading…'}
          </span>
        ))}
      </div>
      {me && (
        <ReadyButton ready={intro.ready[me]} onReady={() => dispatch({ type: 'READY', player: me })} waitingFor={playerName(s, other(me))} />
      )}
    </div>
  )
}

export function ReadyButton({ ready, onReady, waitingFor }: { ready: boolean; onReady: () => void; waitingFor: string }) {
  return ready ? (
    <div className="min-h-[56px] flex items-center justify-center text-sm font-bold text-fg/55">Waiting for {waitingFor}…</div>
  ) : (
    <button onClick={onReady} className={btnPrimary}>I'm ready</button>
  )
}
