import { aboutOne } from './voice'
import type { SessionState, WaveSpectrum } from '../engine/state'

export function spectrumFor(s: SessionState, id: string): WaveSpectrum {
  const w = s.spectrums.find((sp) => sp.id === id) ?? { id, low: '—', high: '—' }
  return { ...w, low: aboutOne(s, w.low), high: aboutOne(s, w.high) }
}
