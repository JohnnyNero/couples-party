import type { SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { useMyPlayerId } from '../../net'
import { playerName } from '../../views/list'
import { Avatar } from '../../ui/Avatar'
import { Clock } from '../Clock'

// Between turns: who's describing next, and how the last turn went.
export function BoardDescribeReady({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const g = s.describe!
  const turn = g.turns[g.current]
  const guesser = other(turn.describer)
  const last = g.current > 0 ? g.turns[g.current - 1] : null
  const mine = me === turn.describer
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center gap-5">
      {last && (
        <div className="text-sm font-bold text-fg/55">
          {playerName(s, last.describer)} got {last.got.length} {last.got.length === 1 ? 'word' : 'words'} across
        </div>
      )}
      <Avatar p={turn.describer} name={playerName(s, turn.describer)} size="xl" className="animate-pop" />
      <div className="font-display text-3xl sm:text-5xl font-extrabold leading-tight">
        {mine ? 'You’re describing' : me === guesser ? `${playerName(s, turn.describer)} describes, you guess` : `${playerName(s, turn.describer)} describes`}
      </div>
      <div className="text-fg/60">{mine ? 'Words come up on your phone. Don’t say the word itself!' : 'Shout out your guesses — as many as you like.'}</div>
      <div className="w-16 h-16 rounded-full border-2 border-fg bg-card inline-flex items-center justify-center font-display text-3xl">
        <Clock phaseEndsAt={s.phaseEndsAt} />
      </div>
    </div>
  )
}

