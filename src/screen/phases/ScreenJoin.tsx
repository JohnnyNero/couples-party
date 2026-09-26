import type { PlayerId, SessionState } from '../../engine/state'
import { GAME_LABELS, roster } from '../../engine/roster'
import { GameGlyph } from '../../ui/GameIcon'
import { Avatar } from '../../ui/Avatar'
import { eyebrow, quietCard } from '../../ui/styles'
import { LobbyInvite } from '../../views/LobbyInvite'

const SESSION_NAMES: Record<string, string> = { tonight: 'Tonight', full: 'The full session' }

// The lobby: two seats, and what's coming. It starts by itself the moment you're both in.
export function ScreenJoin({ s }: { s: SessionState }) {
  const both = s.players.A.connected && s.players.B.connected
  const lineup = roster(s.game, s.night)
  let n = 0
  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-7">
      <div className="text-center">
        <div className={eyebrow}>{SESSION_NAMES[s.game] ?? GAME_LABELS[s.game as keyof typeof GAME_LABELS]}</div>
        <h2 className="mt-1 font-display text-4xl sm:text-5xl font-extrabold leading-none">{both ? 'Here we go!' : 'Getting ready…'}</h2>
      </div>

      <div className="flex items-start justify-center gap-5">
        <Seat s={s} p="A" />
        <span className="mt-9 font-display text-2xl font-extrabold text-fg/25">&amp;</span>
        <Seat s={s} p="B" />
      </div>

      {lineup.length > 1 && (
        <section className={quietCard + ' px-5 py-4 flex flex-col gap-2.5'}>
          <div className={eyebrow}>The line-up</div>
          {lineup.map((e) => {
            const filler = e.key === 'circle' || e.key === 'clock'
            const lights = e.key === 'lights'
            if (!filler && !lights) n += 1
            return (
              <div key={e.key} className={'flex items-center gap-3 text-[0.95rem] font-bold ' + (filler || lights ? 'text-fg/55' : '')}>
                {filler || lights ? (
                  <GameGlyph game={e.key} className="w-6 h-6 shrink-0" />
                ) : (
                  <span className="shrink-0 w-6 h-6 rounded-full bg-fg text-bg text-xs font-extrabold inline-flex items-center justify-center">{n}</span>
                )}
                {GAME_LABELS[e.key]}{filler ? ' · a quick one' : ''}
              </div>
            )
          })}
        </section>
      )}

      <p className="text-center text-sm text-fg/60">Starts the moment you're both here.</p>
      <LobbyInvite s={s} />
    </div>
  )
}

function Seat({ s, p }: { s: SessionState; p: PlayerId }) {
  const pl = s.players[p]
  return (
    <div className="flex flex-col items-center gap-2 w-28">
      {pl.connected ? (
        <span className="relative">
          <Avatar p={p} name={pl.name || '?'} size="xl" className={'ring-[6px] ' + (p === 'A' ? 'ring-pa-soft' : 'ring-pb-soft')} />
          <span className="absolute -right-0.5 -bottom-0.5 w-8 h-8 rounded-full bg-fg border-[3px] border-bg inline-flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="rgb(var(--bg))" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
        </span>
      ) : (
        <span className={'w-24 h-24 rounded-full border-[3px] border-dashed animate-pulse ' + (p === 'A' ? 'border-pa bg-pa-soft' : 'border-pb bg-pb-soft')} />
      )}
      <span className="font-display text-lg font-bold truncate max-w-full">{pl.name || (pl.connected ? p : '')}</span>
      <span className={'text-xs font-extrabold ' + (pl.connected ? 'text-fg/55' : p === 'A' ? 'text-pa-ink' : 'text-pb-ink')}>
        {pl.connected ? 'Here' : 'Joining…'}
      </span>
    </div>
  )
}
