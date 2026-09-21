import gap from '../packs/gap.json'
import list from '../packs/list.json'
import finger from '../packs/finger.json'
import wave from '../packs/wave.json'
import type { Theme, WaveSpectrum } from './engine/state'

// Content never lives in code. Everything the engine needs from the packs is loaded
// once at boot and carried into the session state.
export async function loadPacks(): Promise<{
  seedWords: string[]
  themes: Theme[]
  fingerStatements: string[]
  spectrums: WaveSpectrum[]
}> {
  return {
    seedWords: (gap as { seedWords: string[] }).seedWords,
    themes: (list as { themes: Theme[] }).themes,
    fingerStatements: (finger as { statements: string[] }).statements,
    spectrums: (wave as { spectrums: WaveSpectrum[] }).spectrums,
  }
}
