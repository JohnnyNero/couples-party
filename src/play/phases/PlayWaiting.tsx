import { Waiting } from '../../ui/kit'

export function PlayWaiting({ label, sub }: { label: string; sub?: string }) {
  return <Waiting title={label} sub={sub} />
}
