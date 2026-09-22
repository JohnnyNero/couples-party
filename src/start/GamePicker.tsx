import type { Game } from './mode'
import { PickButton, PickerScreen } from './PickButton'

export function GamePicker({ onPick }: { onPick: (g: Game) => void }) {
  return (
    <PickerScreen prompt="What do you want to play?">
      <PickButton
        onClick={() => onPick('full')}
        title="The full session"
        sub="Shortlist, Finger Down, Wavelength, Quick Draw"
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
      <PickButton
        onClick={() => onPick('draw')}
        title="Quick Draw"
        sub="Sketch it, guess it · six prompts"
      />
    </PickerScreen>
  )
}
