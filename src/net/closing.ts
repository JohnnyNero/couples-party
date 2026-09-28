import type { SessionState } from '../engine/state'

// A game that's over is over. The couple's room outlives it (it's the same room every
// time), so the next game started — from either phone — takes it over, and a phone
// still showing the last one's end screen mustn't be dragged into that.

// What a phone shows: the room's session, until this phone has played one to its end —
// from then on (for the rest of this page) that end screen, whatever the room goes on to
// do. Only a session this phone saw being played counts: arriving to find a finished one
// waiting (the last game's leftovers) isn't yours to keep.
export type EndMemo = { playing: number | null; end: SessionState | null }

export const freshMemo = (): EndMemo => ({ playing: null, end: null })

export function shown(memo: EndMemo, s: SessionState): SessionState {
  if (memo.end) return memo.end
  if (s.phase !== 'DONE') {
    memo.playing = s.seed
    return s
  }
  if (memo.playing === s.seed) memo.end = s
  return s
}

// A phone arriving in the room to start something new finds the last game's end in it:
// that's for replacing, not joining.
export const isLeftover = (room: SessionState | undefined | null): boolean => room?.phase === 'DONE'
