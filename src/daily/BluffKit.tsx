import type { PlayerId } from '../engine/state'
import { Avatar } from '../ui/Avatar'

// The three, once it's over: the true one marked, and whichever the guesser picked.
export function BluffResult({ statements, truth, pick, guesser }: {
  statements: string[]
  truth: number
  pick: number | null
  guesser: { p: PlayerId; name: string }
}) {
  return (
    <div className="w-full max-w-sm flex flex-col gap-2.5">
      {statements.map((text, i) => {
        const isTruth = i === truth
        const picked = i === pick
        return (
          <div
            key={i}
            className={
              'rounded-2xl border-2 px-4 py-3.5 flex items-center gap-3 ' +
              (isTruth ? 'border-sage-ink/60 bg-sage-soft' : picked ? 'border-pa/60 bg-pa-soft' : 'border-fg/15 bg-card')
            }
          >
            <div className="flex-1 min-w-0">
              <div className={'font-display text-lg font-extrabold leading-tight break-words ' + (isTruth || picked ? '' : 'text-fg/55')}>{text}</div>
              <div className={'text-xs font-bold mt-0.5 ' + (isTruth ? 'text-sage-ink' : 'text-fg/40')}>{isTruth ? 'The truth' : 'A lie'}</div>
            </div>
            {picked && <Avatar p={guesser.p} name={guesser.name} size="sm" className="shrink-0" />}
          </div>
        )
      })}
    </div>
  )
}

export const bluffVerdict = (right: boolean, who: string) => (right ? `${who} spotted the truth` : `${who} fell for a lie`)
