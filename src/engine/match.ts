// Deliberately strict. A near-miss the game rejects is better than one it
// generously accepts — the players get to argue about it. Err strict.
export function normalize(word: string): string {
  let s = word.trim().toLowerCase()
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1)
  return s
}

export function isMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const na = normalize(a)
  if (na.length === 0) return false
  return na === normalize(b)
}
