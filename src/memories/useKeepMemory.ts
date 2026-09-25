import { useEffect, useRef } from 'react'
import type { SessionState } from '../engine/state'
import { api } from '../daily/api'
import { localDate } from '../daily/dates'
import { sessionMemory, worthKeeping } from './summary'

// Both phones save the whole session so far each time a game hands over to its
// scoreboard, at Lights Out, and at the end — so a night you stop halfway is still kept,
// and whichever phone saves last, the memory is the fullest version. Unpaired phones
// (or a project without migration 0012) are told no once, and then left alone.
const isSavePoint = (phase: SessionState['phase']) =>
  phase.endsWith('_RESULT') || phase === 'LIGHTS_OUT' || phase === 'DONE'

export function useKeepMemory(s: SessionState, enabled: boolean): void {
  const saved = useRef('')
  const off = useRef(false)
  useEffect(() => {
    if (!enabled || off.current || !isSavePoint(s.phase)) return
    const moment = `${s.seed}|${s.phase}|${s.listActs.length}`
    if (saved.current === moment) return
    const memory = sessionMemory(s)
    if (!worthKeeping(memory)) return
    saved.current = moment
    api.saveMoment(String(s.seed), localDate(), memory).catch(() => {
      off.current = true
    })
  }, [s, enabled])
}
