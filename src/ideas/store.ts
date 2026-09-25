import { useSyncExternalStore } from 'react'
import { api, type Idea, type IdeaKind } from '../daily/api'
import type { Content, WaveSpectrum } from '../engine/state'

// Our questions: the couple's own cards, one shared list. Cached on the phone so a game
// can start with them even when the server is slow, and refreshed whenever the list is
// opened or a game starts.

const KEY = 'couples-party:ideas'
const listeners = new Set<() => void>()

function load(): Idea[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Idea[]) : []
  } catch {
    return []
  }
}

let current: Idea[] = typeof localStorage === 'undefined' ? [] : load()

function set(next: Idea[]) {
  current = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  for (const l of listeners) l()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useIdeas = (): Idea[] => useSyncExternalStore(subscribe, () => current, () => current)

export async function refreshIdeas(): Promise<Idea[]> {
  try {
    set(await api.ideas())
  } catch { /* offline, unpaired, or no migration 0014 — keep what we had */ }
  return current
}

// For a game about to start: the freshest list we can get in a moment, else the cache.
export function ideasForGame(waitMs = 2500): Promise<Idea[]> {
  return Promise.race([refreshIdeas(), new Promise<Idea[]>((r) => setTimeout(() => r(current), waitMs))])
}

export async function addIdea(kind: IdeaKind, text: string): Promise<Idea> {
  const idea = await api.addIdea(kind, text)
  set([...current, idea])
  return idea
}

export async function deleteIdea(id: string): Promise<void> {
  await api.deleteIdea(id)
  set(current.filter((i) => i.id !== id))
}

export const clearIdeas = () => set([])

// The couple's cards added into the games' pools, and marked as theirs so the engine
// deals them first (see oursFirst). Duplicates of built-in cards aren't added twice.
export function withIdeas(content: Content, ideas: Idea[]): Content {
  if (ideas.length === 0) return content
  const of = (k: IdeaKind) => ideas.filter((i) => i.kind === k).map((i) => i.text)
  const add = (pool: string[], extra: string[]) => {
    const have = new Set(pool.map((p) => p.toLowerCase()))
    return [...pool, ...extra.filter((e) => !have.has(e.toLowerCase()))]
  }
  const scales: WaveSpectrum[] = ideas
    .filter((i) => i.kind === 'wave')
    .map((i) => {
      const [low, high] = i.text.split('|').map((x) => x.trim())
      return { id: `ours-${i.id}`, low, high }
    })
    .filter((w) => w.low && w.high)
  const haveScale = new Set(content.spectrums.map((w) => `${w.low} | ${w.high}`.toLowerCase()))
  return {
    ...content,
    mrmrsQuestions: add(content.mrmrsQuestions, of('mrmrs')),
    fingerStatements: add(content.fingerStatements, of('finger')),
    lightsQuestions: add(content.lightsQuestions, of('lights')),
    clashCategories: add(content.clashCategories, of('clash')),
    spectrums: [...content.spectrums, ...scales.filter((w) => !haveScale.has(`${w.low} | ${w.high}`.toLowerCase()))],
    ours: ideas.filter((i) => i.kind !== 'word').map((i) => i.text),
  }
}
