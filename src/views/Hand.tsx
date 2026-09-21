import { FINGER } from '../engine/phases'
import { Dot } from './Dot'

// A hand of dots, one per starting finger — filled is still up, hollow is down.
export function Hand({ fingers }: { fingers: number }) {
  return (
    <div className="flex gap-1 justify-center">
      {Array.from({ length: FINGER.startFingers }, (_, i) => (
        <Dot key={i} on={i < fingers} />
      ))}
    </div>
  )
}
