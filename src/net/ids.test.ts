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
  it('leaves a third device without a seat', () => {
    const seats = { a: 'A' as const, b: 'B' as const }
    expect(claimSeat(seats, 'c', new Set(['a', 'b', 'c'])).seat).toBe(null)
  })
})
