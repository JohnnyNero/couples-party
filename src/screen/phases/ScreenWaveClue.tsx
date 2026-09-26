import type { SessionState } from '../../engine/state'
import { pairOf } from '../../engine/reducer'
import { spectrumFor } from '../../views/wave'
import { playerName } from '../../views/list'
import { WaveDial } from '../../ui/WaveDial'
import { WhoIsIn } from '../../ui/kit'
import { eyebrow } from '../../ui/styles'

// You're both writing a clue at once, each on your own scale. The board shows both
// scales — never the marks, never the clues while they're being written.
export function ScreenWaveClue({ s }: { s: SessionState }) {
  const pair = pairOf(s.wave!)
  const done = { A: false, B: false }
  for (const r of pair) done[r.psychic] = r.clue !== null
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center gap-6">
      <div className="font-display text-2xl sm:text-4xl font-extrabold leading-tight">You’re each naming something on your scale</div>
      <div className="w-full grid sm:grid-cols-2 gap-4">
        {pair.map((r) => {
          const sp = spectrumFor(s, r.spectrumId)
          return (
            <div key={r.index} className="flex flex-col items-center gap-1">
              <div className={eyebrow}>{playerName(s, r.psychic)}’s scale</div>
              <WaveDial low={sp.low} high={sp.high} marker={r.psychic} guesser={r.psychic === 'A' ? 'B' : 'A'} />
            </div>
          )
        })}
      </div>
      <WhoIsIn s={s} done={done} waiting={() => 'Thinking…'} big />
    </div>
  )
}
