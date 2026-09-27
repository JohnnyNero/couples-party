import { key, type Dir, type Entry, type Puzzle } from './build'

// Moving around the grid: which answer a square belongs to, and the squares of an answer.

export type Cursor = { row: number; col: number; dir: Dir }

export const squaresOf = (e: Entry): [number, number][] =>
  Array.from({ length: e.answer.length }, (_, i) => (e.dir === 'across' ? [e.row, e.col + i] : [e.row + i, e.col]))

export function entryAt(p: Puzzle, row: number, col: number, dir: Dir): Entry | null {
  return p.entries.find((e) => e.dir === dir && squaresOf(e).some(([r, c]) => r === row && c === col)) ?? null
}

// Where to start: the first square of the first clue.
export function firstCursor(p: Puzzle): Cursor {
  const e = p.entries[0]
  return { row: e.row, col: e.col, dir: e.dir }
}

// Tapping a square: the answer it's in, keeping direction where it can — and tapping the
// same square again turns to the other one through it.
export function tap(p: Puzzle, cur: Cursor, row: number, col: number): Cursor {
  if (!p.solution[key(row, col)]) return cur
  const other: Dir = cur.dir === 'across' ? 'down' : 'across'
  if (cur.row === row && cur.col === col && entryAt(p, row, col, other)) return { row, col, dir: other }
  if (entryAt(p, row, col, cur.dir)) return { row, col, dir: cur.dir }
  return { row, col, dir: other }
}

// One square along the answer (or back), staying put at its ends.
export function along(p: Puzzle, cur: Cursor, by: 1 | -1): Cursor {
  const e = entryAt(p, cur.row, cur.col, cur.dir)
  if (!e) return cur
  const sq = squaresOf(e)
  const i = sq.findIndex(([r, c]) => r === cur.row && c === cur.col)
  const j = Math.max(0, Math.min(sq.length - 1, i + by))
  return { ...cur, row: sq[j][0], col: sq[j][1] }
}

// The next (or previous) clue, starting on its first empty square.
export function nextClue(p: Puzzle, cur: Cursor, filled: (k: string) => boolean, by: 1 | -1 = 1): Cursor {
  const e = entryAt(p, cur.row, cur.col, cur.dir)
  const i = e ? p.entries.indexOf(e) : -1
  const next = p.entries[(i + by + p.entries.length) % p.entries.length]
  const empty = squaresOf(next).find(([r, c]) => !filled(key(r, c))) ?? squaresOf(next)[0]
  return { row: empty[0], col: empty[1], dir: next.dir }
}

export const isSolved = (p: Puzzle, letterAt: (k: string) => string | undefined) =>
  Object.entries(p.solution).every(([k, l]) => letterAt(k) === l)

export const isFull = (p: Puzzle, letterAt: (k: string) => string | undefined) =>
  Object.keys(p.solution).every((k) => !!letterAt(k))
