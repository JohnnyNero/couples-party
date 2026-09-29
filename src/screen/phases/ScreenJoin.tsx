import type { PlayerId, SessionState } from '../../engine/state'
import { GAME_LABELS, isFiller, roster, SESSION_NAMES, SIZES, sizeOf } from '../../engine/roster'
import { dispatch, useMyPlayerId } from '../../net'
import { btnAccent } from '../../ui/styles'
import { GameGlyph } from '../../ui/GameIcon'
import { Avatar } from '../../ui/Avatar'
import { eyebrow, quietCard } from '../../ui/styles'
import { LobbyInvite } from '../../views/LobbyInvite'
import { useState } from 'react'
import { Burst } from '../../ui/fx'
import { resolveBot, resolveMode } from '../../start/mode'
import { leaveTo } from '../../ui/back'


// The lobby: two seats, and what's coming. Most sessions start by themselves the moment
// you're both in; game night waits for one of you to start it, and until then either of
// you can change how long it is, or deal the games again.
export function ScreenJoin({ s }: { s: SessionState }) {
  const both = s.players.A.connected && s.players.B.connected
  const lineup = roster(s.game, s.night)
  const setUp = s.game === 'quick'
  const me = useMyPlayerId()
  let n = 0
  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-7">
      <div className="text-center">
        <div className={eyebrow}>{SESSION_NAMES[s.game] ?? GAME_LABELS[s.game as keyof typeof GAME_LABELS]}</div>
        <h2 className="mt-1 font-display text-4xl sm:text-5xl font-extrabold leading-none">{both ? (setUp ? 'All here!' : 'Here we go!') : 'Getting ready…'}</h2>
      </div>

      <div className="flex items-start justify-center gap-5">
        <Seat s={s} p="A" />
        <span className="mt-9 font-display text-2xl font-extrabold text-fg/25">&amp;</span>
        <Seat s={s} p="B" />
      </div>

      {setUp && me && <Setup s={s} me={me} />}

      {lineup.length > 1 && (
        <section key={s.night} className={quietCard + ' px-5 py-4 flex flex-col gap-2.5 animate-fade-up'}>
          <div className="flex items-center justify-between gap-3">
            <div className={eyebrow}>The line-up</div>
            {setUp && me && (
              <button onClick={() => dispatch({ type: 'REROLL', player: me })} className="press min-h-[36px] px-3 rounded-xl border-2 border-fg/15 text-sm font-extrabold inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
                Reroll
              </button>
            )}
          </div>
          {lineup.map((e) => {
            const filler = isFiller(e.key)
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

      {setUp ? (
        both && me ? (
          <button className={btnAccent} onClick={() => dispatch({ type: 'START', player: me })}>Start</button>
        ) : (
          <p className="text-center text-sm text-fg/60">Once you’re both here, either of you can start it.</p>
        )
      ) : (
        <p className="text-center text-sm text-fg/60">Starts the moment you're both here.</p>
      )}
      <LobbyInvite s={s} />
      {!both && <BotLink game={s.game} />}
    </div>
  )
}

// How long tonight's game night runs: three lengths, and the current one lit. Either of
// you can change it; the line-up below follows.
function Setup({ s, me }: { s: SessionState; me: PlayerId }) {
  const current = sizeOf(s.night)
  return (
    <section className="flex flex-col gap-2">
      <div className={eyebrow + ' text-center'}>How long?</div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How long">
        {SIZES.map((size, i) => (
          <button
            key={size.label}
            role="radio"
            aria-checked={i === current}
            onClick={() => dispatch({ type: 'SET_SIZE', player: me, size: i })}
            className={'press min-h-[60px] rounded-2xl border-2 px-2 py-1.5 flex flex-col items-center justify-center ' + (i === current ? 'border-fg bg-fg text-bg' : 'border-fg/15 bg-card')}
          >
            <span className="font-display text-lg font-extrabold leading-tight">{size.label}</span>
            <span className={'text-[0.7rem] font-bold ' + (i === current ? 'text-bg/70' : 'text-fg/50')}>{size.games} games · {size.about.replace('about ', '')}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// Solo play is a testing seat, so it's a quiet link here rather than a way to play: it
// leaves this room and starts the same game again against the bot.
function BotLink({ game }: { game: string }) {
  const search = window.location.search
  if (resolveBot(search) || resolveMode(search) === 'solo') return null
  const url = new URL(window.location.pathname, window.location.origin)
  url.searchParams.set('mode', 'solo')
  url.searchParams.set('game', game)
  url.searchParams.set('bot', '1')
  return (
    <button onClick={() => leaveTo(url.toString())} className="self-center min-h-[44px] text-sm font-extrabold text-fg/50 press">
      Testing on your own? Play the bot
    </button>
  )
}

function Seat({ s, p }: { s: SessionState; p: PlayerId }) {
  const pl = s.players[p]
  // Whoever was already here when the lobby opened just sits there; whoever arrives
  // after drops into their seat, with a little burst.
  const [here] = useState(pl.connected)
  const arrived = pl.connected && !here
  return (
    <div className="flex flex-col items-center gap-2 w-28">
      {pl.connected ? (
        <span className={'relative ' + (arrived ? 'animate-seat-in' : '')}>
          {arrived && <Burst delay={350} count={14} spread={0.8} />}
          <Avatar p={p} name={pl.name || '?'} size="xl" className={'ring-[6px] ' + (p === 'A' ? 'ring-pa-soft' : 'ring-pb-soft')} />
          <span className="absolute -right-0.5 -bottom-0.5 w-8 h-8 rounded-full bg-fg border-[3px] border-bg inline-flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="rgb(var(--bg))" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
        </span>
      ) : (
        <span className={'w-24 h-24 rounded-full border-[3px] border-dashed animate-breathe ' + (p === 'A' ? 'border-pa bg-pa-soft' : 'border-pb bg-pb-soft')} />
      )}
      <span className="font-display text-lg font-bold truncate max-w-full">{pl.name || (pl.connected ? p : '')}</span>
      <span className={'text-xs font-extrabold ' + (pl.connected ? 'text-fg/55' : p === 'A' ? 'text-pa-ink' : 'text-pb-ink')}>
        {pl.connected ? 'Here' : 'Joining…'}
      </span>
    </div>
  )
}
