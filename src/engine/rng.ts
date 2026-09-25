// mulberry32 — small, fast, seedable PRNG. Keeps a session reproducible.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

// Fisher–Yates over a copy. Seeded, so the reveal order of a list is reproducible
// and identical on every client without being broadcast field by field.
export function shuffled<T>(rng: () => number, arr: readonly T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Shuffled, but with the couple's own cards (Our questions) dealt ahead of the rest —
// each part shuffled on its own, so which of theirs comes up first still varies.
export function oursFirst<T>(rng: () => number, arr: readonly T[], ours: readonly string[] | undefined, key: (t: T) => string): T[] {
  if (!ours || ours.length === 0) return shuffled(rng, arr)
  const mine = new Set(ours.map((o) => o.toLowerCase()))
  const isOurs = (t: T) => mine.has(key(t).toLowerCase())
  return [...shuffled(rng, arr.filter(isOurs)), ...shuffled(rng, arr.filter((t) => !isOurs(t)))]
}
