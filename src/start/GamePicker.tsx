import type { Game } from './mode'
import { PickButton, PickerScreen } from './PickButton'

export function GamePicker({ onPick }: { onPick: (g: Game) => void }) {
  return (
    <PickerScreen prompt="What do you want to play?">
      <PickButton
        onClick={() => onPick('full')}
        title="The full session"
        sub="Mind Meld · Shortlist, twice over"
      />
      <PickButton
        onClick={() => onPick('meld')}
        title="Mind Meld only"
        sub="Just the co-op warm-up"
      />
      <PickButton
        onClick={() => onPick('list')}
        title="Shortlist only"
        sub="Straight to ranking"
      />
      <PickButton
        onClick={() => onPick('finger')}
        title="Put a Finger Down"
        sub="Five statements · least fingers down wins"
      />
      <PickButton
        onClick={() => onPick('wave')}
        title="Wavelength"
        sub="One clue, one dial · read their mind"
      />
    </PickerScreen>
  )
}
