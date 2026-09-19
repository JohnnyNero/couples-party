import { useSession, useMyPlayerId } from '../net/playroom'
import { PlayJoin } from './phases/PlayJoin'
import { PlayMeldType } from './phases/PlayMeldType'
import { PlayWaiting } from './phases/PlayWaiting'

export function Play() {
  const s = useSession()
  const me = useMyPlayerId()
  if (!me) return <PlayWaiting label="CONNECTING…" />
  switch (s.phase) {
    case 'JOIN': return <PlayJoin s={s} me={me} />
    case 'MELD_TYPE': return <PlayMeldType s={s} me={me} />
    case 'MELD_REVEAL': return <PlayWaiting label="…" />
    case 'MELD_RESULT': return <PlayWaiting label="SEE THE SCREEN" />
    case 'DONE': return <PlayWaiting label="THAT'S THE ROUND" />
    default: return <PlayWaiting label="SEE THE SCREEN" />
  }
}
