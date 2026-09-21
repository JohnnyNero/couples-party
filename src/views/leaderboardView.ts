import type { PlayerId, SessionState } from '../engine/state'
import { other } from '../engine/state'
import { standing } from '../engine/standing'
import { getLeaderboard } from '../store/leaderboard'
import { playerName } from './list'

export type LeaderboardView = {
  you: string
  them: string
  session: { you: number; them: number }
  weekly: { you: number; them: number }
  allTime: { you: number; them: number }
}

// Everything a "you vs them" leaderboard display needs, framed from one device's own
// point of view — there is no server, so "you" only means whoever this phone is.
export function leaderboardView(s: SessionState, me: PlayerId): LeaderboardView {
  const opp = other(me)
  const you = playerName(s, me)
  const them = playerName(s, opp)
  const tally = standing(s)
  const board = getLeaderboard()
  return {
    you,
    them,
    session: { you: tally[me], them: tally[opp] },
    weekly: { you: board.weekly[you] ?? 0, them: board.weekly[them] ?? 0 },
    allTime: { you: board.allTime[you] ?? 0, them: board.allTime[them] ?? 0 },
  }
}
