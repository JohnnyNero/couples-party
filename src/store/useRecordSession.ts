import { useEffect, useRef } from 'react'
import type { SessionState } from '../engine/state'
import { standing } from '../engine/standing'
import { playerName } from '../views/list'
import { recordSession } from './leaderboard'

// Records this session's points into the local leaderboard the moment it reaches DONE.
// Runs on every client, not just the host — the leaderboard is local to this device,
// not synced over the network — and only once per session (guarded by seed, since a
// session that has reached DONE keeps re-rendering on this same phase).
export function useRecordSession(s: SessionState): void {
  const recorded = useRef<number | null>(null)
  useEffect(() => {
    if (s.phase !== 'DONE') return
    if (recorded.current === s.seed) return
    recorded.current = s.seed
    const tally = standing(s)
    const points: Record<string, number> = {}
    for (const p of ['A', 'B'] as const) {
      const name = playerName(s, p)
      points[name] = (points[name] ?? 0) + tally[p]
    }
    recordSession(points)
  }, [s.phase, s.seed])
}
