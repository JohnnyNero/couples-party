import type { Game } from './mode'
import { PickButton, PickerScreen } from './PickButton'

export function GamePicker({ onPick }: { onPick: (g: Game) => void }) {
  return (
    <PickerScreen prompt="What do you want to play?">
      <PickButton
        onClick={() => onPick('full')}
        title="The full session"
        sub="The stake · Mind Meld · Shortlist, twice over"
      />
      <PickButton
        onClick={() => onPick('meld')}
        title="Mind Meld only"
        sub="Just the co-op warm-up · no stake, nothing on the line"
      />
      <PickButton
        onClick={() => onPick('list')}
        title="Shortlist only"
        sub="Agree a stake, then straight to ranking"
      />
    </PickerScreen>
  )
}
