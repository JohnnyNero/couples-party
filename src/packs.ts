import gap from '../packs/gap.json'
import list from '../packs/list.json'
import type { Theme } from './engine/state'

// Content never lives in code. Everything the engine needs from the packs is loaded
// once at boot and carried into the session state.
export async function loadPacks(): Promise<{ seedWords: string[]; themes: Theme[] }> {
  return {
    seedWords: (gap as { seedWords: string[] }).seedWords,
    themes: (list as { themes: Theme[] }).themes,
  }
}
