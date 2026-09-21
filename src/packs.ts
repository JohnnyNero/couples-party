import list from '../packs/list.json'
import finger from '../packs/finger.json'
import wave from '../packs/wave.json'
import draw from '../packs/draw.json'
import type { DrawPrompt, Theme, WaveSpectrum } from './engine/state'

// Content never lives in code. Everything the engine needs from the packs is loaded
// once at boot and carried into the session state.
export async function loadPacks(): Promise<{
  themes: Theme[]
  fingerStatements: string[]
  spectrums: WaveSpectrum[]
  drawPrompts: DrawPrompt[]
}> {
  return {
    themes: (list as { themes: Theme[] }).themes,
    fingerStatements: (finger as { statements: string[] }).statements,
    spectrums: (wave as { spectrums: WaveSpectrum[] }).spectrums,
    drawPrompts: (draw as { prompts: DrawPrompt[] }).prompts,
  }
}
