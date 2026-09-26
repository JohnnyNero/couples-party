import { shown as scaled } from '../../engine/standing'
import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { waveAward } from '../../engine/standing'
import { spectrumFor } from '../../views/wave'
import { AnimatedNumber } from '../../views/AnimatedNumber'
import { playerName } from '../../views/list'
import { WaveDial } from '../../ui/WaveDial'
import { Said } from '../../ui/kit'
import { fillOf, inkOf } from '../../ui/Avatar'

export function ScreenWaveReveal({ s }: { s: SessionState }) {
  const w = s.wave!
  const round = w.rounds[w.current]
  const spectrum = spectrumFor(s, round.spectrumId)
  const award = waveAward(round)
  const guesser = other(round.psychic)
  const d = round.distance ?? 0
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center gap-5">
      <Said s={s} p={round.psychic}>{round.clue}</Said>
      <WaveDial
        low={spectrum.low}
        high={spectrum.high}
        target={round.target}
        guess={round.guess}
        marker={round.psychic}
        guesser={guesser}
        reveal
      />
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs sm:text-base font-extrabold">
        <span className="flex items-center gap-1.5"><span className={'w-3 h-3 rounded ' + fillOf(round.psychic)} />{playerName(s, round.psychic)}’s mark · {round.target}</span>
        <span className="flex items-center gap-1.5"><span className={'w-3.5 h-1 rounded ' + fillOf(guesser)} />{playerName(s, guesser)}’s guess · {round.guess}</span>
      </div>
      <div className="animate-fade-up" style={{ animationDelay: '700ms' }}>
        <div className="font-display text-4xl sm:text-6xl font-extrabold leading-none">{verdict(d)}</div>
        <div className="mt-1.5 text-base sm:text-xl text-fg/70">
          <span className="tabular-nums"><AnimatedNumber value={d} /></span> away
          {award ? (
            <> · <b className={inkOf(award.player)}>{playerName(s, award.player)} +{scaled(s, 'wave', award.points)}</b>{award.player === round.psychic ? ' for the clue' : ''}</>
          ) : ' · no points'}
        </div>
      </div>
    </div>
  )
}

function verdict(d: number): string {
  if (d === 0) return 'Bullseye!'
  if (d <= 5) return 'So close!'
  if (d <= 15) return 'Not bad'
  if (d <= 30) return 'Off the mark'
  return 'Miles off'
}
