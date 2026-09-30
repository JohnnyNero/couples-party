import { describe, it, expect } from 'vitest'
import stateSource from '../engine/state.ts?raw'
import controllerSource from './controller.tsx?raw'
import boardSource from './board.tsx?raw'
import { BOARD_ONLY } from './controller'

// Every stage of every game is drawn on the phones by exactly one thing: the board (the
// whole screen, when there's nothing private to ask) or this player's controller. Nothing
// falls through to a blank or placeholder screen, and neither has cases the other owns.

const cases = (src: string) => new Set([...src.matchAll(/case '([A-Z_]+)':/g)].map((m) => m[1]))
// In the Phase type but never entered: an early game that was cut, and the pre-JOIN boot.
const NEVER = /^(BOOT|GAP_|SUDDEN_DEATH|SOUVENIR)/
const phases = [...stateSource.slice(stateSource.indexOf('export type Phase =')).split('\n\n')[0].matchAll(/'([A-Z_]+)'/g)]
  .map((m) => m[1])
  .filter((p) => !NEVER.test(p))

describe('every game stage has a screen', () => {
  const controller = cases(controllerSource)
  const board = cases(boardSource)
  it.each(phases)('%s', (phase) => {
    if (BOARD_ONLY.has(phase)) {
      expect(board.has(phase) || phase === 'LIGHTS_OUT').toBe(true) // Lights Out is drawn full-bleed by Duo itself
      expect(controller.has(phase)).toBe(false)
    } else {
      expect(controller.has(phase)).toBe(true)
      expect(board.has(phase)).toBe(false)
    }
  })
})
