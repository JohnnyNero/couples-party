// Laying out the week's crossword: a free-form criss-cross, where words cross wherever a
// letter matches — the only kind of grid your own answers (which rarely interlock) can
// make. Tries many orders and keeps the best: the most of your words placed, crossing
// the most, in the tightest grid a phone can show.

export type Candidate = { answer: string; clue: string; who: string | null }
export type Dir = 'across' | 'down'
export type Entry = { n: number; dir: Dir; row: number; col: number; answer: string; clue: string; who: string | null }
export type Puzzle = { v: 1; w: number; h: number; entries: Entry[]; solution: Record<string, string>; answers: string[] }

export const MAX_SIDE = 11 // squares across or down: what fits a phone comfortably
export const MIN_LEN = 3
export const MAX_LEN = 9

export const key = (r: number, c: number) => `${r},${c}`

type Placed = { cand: Candidate; row: number; col: number; dir: Dir }
type Layout = { placed: Placed[]; cells: Map<string, string>; dirs: Map<string, Set<Dir>>; crossings: number }

const step = (dir: Dir): [number, number] => (dir === 'across' ? [0, 1] : [1, 0])

function bounds(cells: Map<string, string>) {
  let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity
  for (const k of cells.keys()) {
    const [r, c] = k.split(',').map(Number)
    r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c)
  }
  return { r0, r1, c0, c1 }
}

// Can `word` go here? Returns how many letters it would share, or -1 if it can't: it must
// cross at least once, never sit side by side with another word, never run on into one,
// and keep the grid within MAX_SIDE.
function fits(layout: Layout, word: string, row: number, col: number, dir: Dir): number {
  const [dr, dc] = step(dir)
  const cells = layout.cells
  const before = key(row - dr, col - dc)
  const after = key(row + dr * word.length, col + dc * word.length)
  if (cells.has(before) || cells.has(after)) return -1
  let shared = 0
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i
    const c = col + dc * i
    const here = cells.get(key(r, c))
    if (here !== undefined) {
      // A shared square is only ever a crossing, never two words running along each other.
      if (here !== word[i] || layout.dirs.get(key(r, c))?.has(dir)) return -1
      shared++
      continue
    }
    // A new square: nothing either side of it, across the word's direction.
    if (cells.has(key(r + dc, c + dr)) || cells.has(key(r - dc, c - dr))) return -1
  }
  if (shared === 0 || shared === word.length) return -1
  const b = bounds(cells)
  const r0 = Math.min(b.r0, row), c0 = Math.min(b.c0, col)
  const r1 = Math.max(b.r1, row + dr * (word.length - 1)), c1 = Math.max(b.c1, col + dc * (word.length - 1))
  if (r1 - r0 + 1 > MAX_SIDE || c1 - c0 + 1 > MAX_SIDE) return -1
  return shared
}

function place(layout: Layout, cand: Candidate, row: number, col: number, dir: Dir, shared: number) {
  const [dr, dc] = step(dir)
  for (let i = 0; i < cand.answer.length; i++) {
    const k = key(row + dr * i, col + dc * i)
    layout.cells.set(k, cand.answer[i])
    if (!layout.dirs.has(k)) layout.dirs.set(k, new Set())
    layout.dirs.get(k)!.add(dir)
  }
  layout.placed.push({ cand, row, col, dir })
  layout.crossings += shared
}

// The best spot for a word: the most shared letters, then the smallest grid.
function bestSpot(layout: Layout, word: string): { row: number; col: number; dir: Dir; shared: number } | null {
  let best: { row: number; col: number; dir: Dir; shared: number; area: number } | null = null
  for (const [k, letter] of layout.cells) {
    const [r, c] = k.split(',').map(Number)
    for (let i = 0; i < word.length; i++) {
      if (word[i] !== letter) continue
      for (const dir of ['across', 'down'] as Dir[]) {
        const [dr, dc] = step(dir)
        const row = r - dr * i
        const col = c - dc * i
        const shared = fits(layout, word, row, col, dir)
        if (shared < 1) continue
        const b = bounds(layout.cells)
        const area = (Math.max(b.r1, row + dr * (word.length - 1)) - Math.min(b.r0, row) + 1)
          * (Math.max(b.c1, col + dc * (word.length - 1)) - Math.min(b.c0, col) + 1)
        if (!best || shared > best.shared || (shared === best.shared && area < best.area)) best = { row, col, dir, shared, area }
      }
    }
  }
  return best
}

function attempt(words: Candidate[], target: number): Layout {
  const layout: Layout = { placed: [], cells: new Map(), dirs: new Map(), crossings: 0 }
  const [first, ...rest] = words
  place(layout, first, 0, 0, 'across', 0)
  // Two passes: a word that crossed nothing the first time round may cross a later one.
  let queue = rest
  for (let pass = 0; pass < 2 && layout.placed.length < target; pass++) {
    const left: Candidate[] = []
    for (const cand of queue) {
      if (layout.placed.length >= target) break
      const spot = bestSpot(layout, cand.answer)
      if (spot) place(layout, cand, spot.row, spot.col, spot.dir, spot.shared)
      else left.push(cand)
    }
    queue = left
  }
  return layout
}

function shuffle<T>(rng: () => number, xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Numbers the squares the way every crossword does — left to right, top to bottom, a
// number wherever an answer starts — and writes out the puzzle.
function finish(layout: Layout): Puzzle {
  const b = bounds(layout.cells)
  const shiftR = -b.r0
  const shiftC = -b.c0
  const starts = new Map<string, number>()
  const ordered = [...layout.placed].sort((x, y) => (x.row - y.row) || (x.col - y.col))
  let n = 0
  for (const p of ordered) {
    const k = key(p.row, p.col)
    if (!starts.has(k)) starts.set(k, ++n)
  }
  const entries: Entry[] = ordered.map((p) => ({
    n: starts.get(key(p.row, p.col))!,
    dir: p.dir,
    row: p.row + shiftR,
    col: p.col + shiftC,
    answer: p.cand.answer,
    clue: p.cand.clue,
    who: p.cand.who,
  }))
  const solution: Record<string, string> = {}
  for (const [k, letter] of layout.cells) {
    const [r, c] = k.split(',').map(Number)
    solution[key(r + shiftR, c + shiftC)] = letter
  }
  return {
    v: 1,
    w: b.c1 - b.c0 + 1,
    h: b.r1 - b.r0 + 1,
    entries: entries.sort((x, y) => (x.dir === y.dir ? x.n - y.n : x.dir === 'across' ? -1 : 1)),
    solution,
    answers: entries.map((e) => e.answer),
  }
}

// `personal` are yours (already balanced between you), `general` the top-up. Aims for
// `target` words; general ones only go in once every personal one that can has.
export function buildCrossword(personal: Candidate[], general: Candidate[], rng: () => number, target = 12): Puzzle | null {
  const ok = (c: Candidate) => c.answer.length >= MIN_LEN && c.answer.length <= MAX_LEN
  const mine = personal.filter(ok)
  const extra = general.filter(ok)
  if (mine.length + extra.length < 2) return null
  let best: Layout | null = null
  const score = (l: Layout) => {
    const own = l.placed.filter((p) => p.cand.who !== null).length
    const b = bounds(l.cells)
    return own * 1000 + l.placed.length * 100 + l.crossings * 10 - (b.r1 - b.r0 + b.c1 - b.c0)
  }
  for (let i = 0; i < 60; i++) {
    // Your longest words make the best spine; the rest in a fresh order each try.
    const ownOrder = i === 0 ? [...mine].sort((a, b) => b.answer.length - a.answer.length) : shuffle(rng, mine)
    const words = [...ownOrder, ...shuffle(rng, extra)]
    if (words.length === 0) continue
    const l = attempt(words, target)
    if (!best || score(l) > score(best)) best = l
  }
  return best && best.placed.length >= 2 ? finish(best) : null
}
