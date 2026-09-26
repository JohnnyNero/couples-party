import { api } from '../daily/api'
import { localDate } from '../daily/dates'
import { computeRecords, type Records } from './records'

// Your records as they stood when tonight's game began — fetched at the start, because
// tonight is saved into them as it goes (see useKeepMemory), and a best is only new
// against the ones from before it. Once per page: a game is one page load.
let pending: Promise<void> | null = null
let before: Records | null = null

export function fetchBaseline(me: string): void {
  if (pending || !me) return
  pending = api.records()
    .then((rows) => { before = computeRecords(rows, me, localDate()) })
    .catch(() => { before = null })
}

// null until it's arrived (or for an unpaired phone, which has no records).
export const baseline = (): Records | null => before
