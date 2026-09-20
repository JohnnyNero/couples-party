import type { PlayMode } from './mode'
import { PickButton, PickerScreen } from './PickButton'

export function ModePicker({ onPick }: { onPick: (m: PlayMode, bot?: boolean) => void }) {
  return (
    <PickerScreen prompt="How are you playing?">
      <PickButton
        onClick={() => onPick('screen')}
        title="With a TV or laptop"
        sub="This screen is the board · two phones are the controllers"
      />
      <PickButton
        onClick={() => onPick('duo')}
        title="Just two phones"
        sub="No shared screen · each phone shows the board and your controls"
      />
      <PickButton
        onClick={() => onPick('solo', true)}
        title="On your own"
        sub="A bot takes the other seat · for testing the loop, not for a night in"
      />
    </PickerScreen>
  )
}
