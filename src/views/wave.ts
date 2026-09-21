import type { SessionState, WaveSpectrum } from '../engine/state'

export function spectrumFor(s: SessionState, id: string): WaveSpectrum {
  return s.spectrums.find((sp) => sp.id === id) ?? { id, low: '—', high: '—' }
}
