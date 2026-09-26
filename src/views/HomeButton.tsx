import { useMyPlayerId } from '../net'
import { leaveTo } from '../ui/back'
import { btnAccent } from '../ui/styles'

// The end of the night: the way out, back to Home. Phones only — a TV has nowhere to go.
export function HomeButton() {
  const me = useMyPlayerId()
  if (!me) return null
  return (
    <button className={btnAccent + ' mt-5'} onClick={() => leaveTo(window.location.pathname)}>
      Back to home
    </button>
  )
}
