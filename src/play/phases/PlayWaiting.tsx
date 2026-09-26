import { other } from '../../engine/state'
import { useMyPlayerId, useSession } from '../../net'
import { Waiting, useDoing } from '../../ui/kit'
import { playerName } from '../../views/list'

// A phone with nothing to do this moment — nearly always because it's waiting on the
// other one, so it shows them: breathing, and what they're up to right now.
export function PlayWaiting({ label, sub }: { label: string; sub?: string }) {
  const s = useSession()
  const me = useMyPlayerId()
  const them = me ? other(me) : 'B'
  const doing = useDoing(s, them)
  return <Waiting title={label} sub={sub} them={me ? { p: them, name: playerName(s, them), doing } : null} />
}
