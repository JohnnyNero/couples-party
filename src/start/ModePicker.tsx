import type { PlayMode } from './mode'
import { PickButton, PickerScreen } from './PickButton'

export function ModePicker({
  onPick,
  onBack,
}: {
  onPick: (m: PlayMode, bot?: boolean) => void
  onBack?: () => void
}) {
  return (
    <PickerScreen prompt="How are you playing?" onBack={onBack}>
      <PickButton
        onClick={() => onPick('duo')}
        title="Just two phones"
        sub="The usual way · each of you on your own phone"
      />
      <PickButton
        onClick={() => onPick('screen')}
        title="With a TV or laptop"
        sub="This screen is the board · two phones are the controllers"
      />
      <PickButton
        onClick={() => onPick('solo', true)}
        title="On your own"
        sub="A bot takes the other seat · for testing the loop, not for a night in"
      />
    </PickerScreen>
  )
}
