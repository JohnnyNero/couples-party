import { useState } from 'react'
import { api } from '../daily/api'
import { patchCouple, profileNow, useProfile } from './store'

// Rude questions: the few entries in the content file tagged "(rude)" (see content.ts).
// A couple's setting, kept with the couple (migration 0027) so it's the same on both
// phones and whoever's phone deals the game. A phone that isn't in a couple keeps its
// own. Off unless someone's switched it on.

const KEY = 'couples-party:rude'

function localRude(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function rudeOn(): boolean {
  const p = profileNow()
  return p && p.state !== 'single' ? p.rude === true : localRude()
}

export function useRude(): [boolean, (on: boolean) => Promise<void>] {
  const p = useProfile()
  const [local, setLocal] = useState(localRude)
  const inCouple = !!p && p.state !== 'single'
  const on = inCouple ? p.rude === true : local
  const set = async (next: boolean) => {
    if (!inCouple) {
      try { localStorage.setItem(KEY, next ? '1' : '0') } catch { /* private mode */ }
      setLocal(next)
      return
    }
    patchCouple({ rude: next })
    try { await api.setRude(next) } catch (e) { patchCouple({ rude: !next }); throw e }
  }
  return [on, set]
}
