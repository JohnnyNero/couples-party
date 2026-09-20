import type { PlayerId, SessionState } from '../engine/state'
import { PlayJoin } from '../play/phases/PlayJoin'
import { PlayStakeSet } from '../play/phases/PlayStakeSet'
import { PlayMeldType } from '../play/phases/PlayMeldType'
import { PlayListWrite } from '../play/phases/PlayListWrite'
import { PlayListSwap } from '../play/phases/PlayListSwap'
import { PlayListPlace } from '../play/phases/PlayListPlace'
import { PlayWaiting } from '../play/phases/PlayWaiting'

// This player's private controller for the current phase, shared by the phone
// renderer (Play, screen mode) and the phones-only renderer (Duo). Shows only this
// player's own input — never the other player's.
export function Controller({ s, me }: { s: SessionState; me: PlayerId }) {
  switch (s.phase) {
    case 'JOIN':
      return <PlayJoin s={s} me={me} />
    case 'STAKE_SET':
      return <PlayStakeSet s={s} />
    case 'STAKE_REVEAL':
      return <PlayWaiting label="The stake is set" />
    case 'MELD_TYPE':
      return <PlayMeldType s={s} me={me} />
    case 'MELD_REVEAL':
      return <PlayWaiting label="Reveal" />
    case 'MELD_RESULT':
      return <PlayWaiting label="See the board" />
    case 'LIST_WRITE':
      return <PlayListWrite s={s} me={me} />
    case 'LIST_SWAP':
      return <PlayListSwap s={s} me={me} />
    case 'LIST_PLACE':
      return <PlayListPlace s={s} me={me} />
    case 'LIST_REVEAL':
      return <PlayWaiting label="See the board" />
    case 'DONE':
      return <PlayWaiting label="That's the session" />
    default:
      return <PlayWaiting label="See the board" />
  }
}
