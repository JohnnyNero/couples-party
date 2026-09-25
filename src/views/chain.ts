import type { ChainReject } from '../engine/state'

export function rejectText(r: ChainReject, need: string, category: string): string {
  if (r.reason === 'letter') return `"${r.word}" doesn't start with ${need.toUpperCase()}`
  if (r.reason === 'used') return `"${r.word}" is already in the chain`
  return `"${r.word}" isn't on the ${category} list`
}

// "an R", "a B" — the letter as you'd say it out loud.
export const aLetter = (l: string) => `${'aefhilmnorsx'.includes(l.toLowerCase()) ? 'an' : 'a'} ${l.toUpperCase()}`
