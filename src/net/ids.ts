import type { PlayerId } from '../engine/state'

// Which seat each device sits in, A or B. The HOST decides and shares the answer with
// everyone (a Playroom state, see playroom.ts) — no phone ever works it out for itself.
// It used to: each phone numbered players in the order they turned up on THAT phone,
// and since every phone sees itself first, two phones could both decide they were A and
// end up playing the same seat.
//
// Keyed by Playroom's per-device player id. A seat held by someone who's no longer in
// the room can be taken over — that's a phone coming back after a reload or a dropped
// connection, which may arrive with a new id.

export type Seats = Record<string, PlayerId>

const ORDER: PlayerId[] = ['A', 'B']

export function claimSeat(seats: Seats, id: string, present: ReadonlySet<string>): { seats: Seats; seat: PlayerId | null } {
  if (seats[id]) return { seats, seat: seats[id] }
  for (const seat of ORDER) {
    const heldByPresent = Object.entries(seats).some(([pid, s]) => s === seat && present.has(pid) && pid !== id)
    if (heldByPresent) continue
    const next: Seats = {}
    for (const [pid, s] of Object.entries(seats)) if (s !== seat) next[pid] = s
    next[id] = seat
    return { seats: next, seat }
  }
  return { seats, seat: null } // both seats taken by people who are here: a third device watches
}
