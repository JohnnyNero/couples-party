import { describe, it, expect } from 'vitest'
import { claimSeat } from './ids'

describe('claimSeat', () => {
  it('seats the first to arrive in A and the second in B', () => {
    const a = claimSeat({}, 'her-phone', new Set(['her-phone']))
    expect(a.seat).toBe('A')
    const b = claimSeat(a.seats, 'his-phone', new Set(['her-phone', 'his-phone']))
    expect(b.seat).toBe('B')
    expect(b.seats).toEqual({ 'her-phone': 'A', 'his-phone': 'B' })
  })
  it('gives the same seat back to the same device', () => {
    const seats = { 'her-phone': 'A' as const, 'his-phone': 'B' as const }
    expect(claimSeat(seats, 'his-phone', new Set(['her-phone', 'his-phone'])).seat).toBe('B')
  })
  it('never puts two devices in the same seat', () => {
    const seats = { 'her-phone': 'A' as const }
    const b = claimSeat(seats, 'his-phone', new Set(['her-phone', 'his-phone']))
    expect(b.seat).toBe('B')
  })
  it('lets a device that came back with a new id take the seat nobody present is holding', () => {
    const seats = { 'her-phone': 'A' as const, 'his-old-id': 'B' as const }
    const back = claimSeat(seats, 'his-new-id', new Set(['her-phone', 'his-new-id']))
    expect(back.seat).toBe('B')
    expect(back.seats).toEqual({ 'her-phone': 'A', 'his-new-id': 'B' })
  })
  it('reuses a stale room from an earlier night: whoever is here gets seated', () => {
    const lastNight = { 'old-1': 'A' as const, 'old-2': 'B' as const }
    const first = claimSeat(lastNight, 'tonight-1', new Set(['tonight-1']))
    expect(first.seat).toBe('A')
    expect(claimSeat(first.seats, 'tonight-2', new Set(['tonight-1', 'tonight-2'])).seat).toBe('B')
  })
  it('gives a phone its own seat back by its lasting id, however it came back', () => {
    // Seated by each phone's own lasting id: coming back on a new connection — even
    // before the old one has timed out, or before its partner's — is still the same key.
    const seats = { 'her-phone': 'A' as const, 'his-phone': 'B' as const }
    expect(claimSeat(seats, 'his-phone', new Set(['her-phone', 'his-phone'])).seat).toBe('B')
    expect(claimSeat(seats, 'his-phone', new Set(['his-phone'])).seat).toBe('B') // first back in
    expect(claimSeat(seats, 'her-phone', new Set(['his-phone', 'her-phone'])).seat).toBe('A')
  })
  it('leaves a third device without a seat', () => {
    const seats = { a: 'A' as const, b: 'B' as const }
    expect(claimSeat(seats, 'c', new Set(['a', 'b', 'c'])).seat).toBe(null)
  })
})
