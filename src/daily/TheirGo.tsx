import type { DialView, EitherView, NumbersView, PuzzleView, SketchView, Top5View } from './api'
import { EitherResult } from './EitherKit'
import { eitherSummary } from './either'
import { TileRow } from './Tiles'
import { closeness } from './DialCard'
import { outcome } from './Top5Card'
import { parseSpectrumPrompt } from './dial'
import { renderQuestion } from './question'
import { RevealLadder } from './PlayTop5'
import { DrawingCanvas } from '../views/DrawingCanvas'
import { WaveDial } from '../ui/WaveDial'
import { say } from '../say'
import { eyebrow } from '../ui/styles'

// How your partner did on the puzzle you set them today — their whole go, replayed from
// your side: your answer or mark or order, next to what they did with it. Opened from
// your own finished puzzle's result, once they've finished yours.

export type Mine = PuzzleView | DialView | Top5View | SketchView | NumbersView | EitherView

const NAMES = { word: 'Their Word', dial: 'The Dial', top5: 'Top 5', sketch: 'Sketch', numbers: 'Their Numbers', either: 'This or That' } as const

export function TheirGo({ puzzle, partner, me, onClose }: { puzzle: Mine; partner: string; me: string; onClose: () => void }) {
  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className={eyebrow}>{NAMES[puzzle.kind]} · {partner}’s go at yours</div>
          <div className="font-display text-xl font-extrabold leading-tight">{title(puzzle, partner, me)}</div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8 pt-2 flex flex-col items-center gap-4 animate-fade-up">
        <Replay puzzle={puzzle} partner={partner} me={me} />
        <button onClick={onClose} className="mt-2 w-full max-w-sm min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px">
          Back to mine
        </button>
      </div>
    </div>
  )
}

// The puzzle as you set it — in your own words ("Your comfort food").
function title(p: Mine, partner: string, me: string): string {
  switch (p.kind) {
    case 'word': return renderQuestion(p.prompt, partner)
    case 'dial': { const { low, high } = parseSpectrumPrompt(p.prompt); return `${low} ↔ ${high}` }
    case 'top5': return say(p.prompt, { self: true, subject: me, partner })
    case 'sketch': return `Your ${p.prompt}`
    case 'numbers': return 'Your numbers'
    case 'either': return 'Your picks'
  }
}

function Verdict({ children }: { children: React.ReactNode }) {
  return <div className="font-display text-3xl font-extrabold text-accent-ink text-center leading-tight">{children}</div>
}

function Replay({ puzzle: p, partner, me }: { puzzle: Mine; partner: string; me: string }) {
  switch (p.kind) {
    case 'word': {
      const length = p.answer?.length ?? p.length ?? 5
      return (
        <>
          <div className="text-sm text-fg/60">You answered <b className="uppercase tracking-wider text-fg">{p.answer}</b></div>
          <div className="flex flex-col gap-1.5">
            {p.guesses.map((g, i) => <TileRow key={i} letters={g} pattern={p.patterns[i]} length={length} size="lg" />)}
          </div>
          <Verdict>{p.status === 'solved' ? `${partner} got it in ${p.guesses.length}` : `${partner} didn’t get it`}</Verdict>
        </>
      )
    }
    case 'dial': {
      const { low, high } = parseSpectrumPrompt(p.prompt)
      return (
        <>
          <div className="text-sm text-fg/60">Your clue: <b className="text-fg">“{p.clue}”</b></div>
          <div className="w-full max-w-sm"><WaveDial low={low} high={high} target={p.target} guess={p.guess} marker="A" guesser="B" reveal /></div>
          <Verdict>{closeness(p.distance ?? 100)}</Verdict>
          <div className="text-sm text-fg/60">{partner} placed it {p.distance} away from your mark.</div>
        </>
      )
    }
    case 'top5':
      return (
        <>
          <RevealLadder puzzle={p} order={{ p: 'A', name: me, label: 'Your order' }} guesser={{ p: 'B', name: partner, label: `${partner}’s guess` }} />
          <Verdict>{outcome(p.exact ?? 0, p.near ?? 0)}</Verdict>
        </>
      )
    case 'sketch':
      return (
        <>
          <div className="w-full max-w-sm"><DrawingCanvas strokes={p.strokes} /></div>
          <div className="text-sm text-fg/60">You drew <b className="uppercase tracking-wider text-fg">{p.answer}</b></div>
          <div className="flex flex-wrap justify-center gap-2">
            {p.guesses.map((g, i) => {
              const hit = p.status === 'solved' && i === p.guesses.length - 1
              return (
                <span key={i} className={'px-3 py-1 rounded-full text-sm font-bold ' + (hit ? 'bg-correct text-white' : 'bg-fg/10 text-fg/50 line-through')}>
                  {g}
                </span>
              )
            })}
          </div>
          <Verdict>{p.status === 'solved' ? `${partner} got it in ${p.guesses.length}` : `${partner} didn’t get it`}</Verdict>
        </>
      )
    case 'numbers':
      return (
        <div className="w-full flex flex-col gap-2.5">
          {p.questions.map((q, i) => {
            const mark = p.marks?.[i]
            return (
              <div
                key={i}
                className={
                  'rounded-2xl border-2 px-4 py-3 ' +
                  (mark === 'exact' ? 'border-sage-ink bg-sage-soft' : mark === 'close' ? 'border-tan-ink/50 bg-tan-soft' : 'border-fg/15 bg-card')
                }
              >
                <div className="text-sm leading-snug">{renderQuestion(q, partner)}</div>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="font-display text-3xl font-bold tabular-nums text-pa-ink">{p.answers?.[i]}</span>
                  <span className="text-sm font-bold text-pb-ink tabular-nums">
                    {partner} guessed {p.guesses?.[i]}{mark === 'exact' ? ' · exact' : mark === 'close' ? ' · close' : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )
    case 'either':
      return (
        <>
          <EitherResult
            questions={p.questions}
            answers={p.answers ?? []}
            guesses={p.guesses ?? []}
            setter={{ p: 'A', name: 'You' }}
            guesser={{ p: 'B', name: partner }}
          />
          <Verdict>{eitherSummary(p.matches ?? 0)}</Verdict>
        </>
      )
  }
}

// The button under your own result: greyed out until they've finished yours.
export function TheirGoButton({ puzzle, partner, onOpen }: { puzzle: Mine | null; partner: string; onOpen: () => void }) {
  if (!puzzle) return null
  const finished = puzzle.status !== 'open'
  const playing = !finished && 'guesses' in puzzle && Array.isArray(puzzle.guesses) && puzzle.guesses.length > 0
  return (
    <button
      onClick={onOpen}
      disabled={!finished}
      className="w-full max-w-sm min-h-[52px] rounded-2xl bg-pb text-white font-display text-lg font-extrabold active:translate-y-px disabled:bg-fg/10 disabled:text-fg/45"
    >
      {finished ? `See how ${partner} did on yours` : playing ? `${partner}’s still playing yours` : `${partner} hasn’t played yours yet`}
    </button>
  )
}
