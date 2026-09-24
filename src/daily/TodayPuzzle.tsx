import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { DailyCard, StreakBadge, type DailyScreen } from './DailyCard'
import { localDate } from './dates'
import { DialCard, type DialScreen } from './DialCard'
import { NumbersCard, type NumbersScreen } from './NumbersCard'
import { PlayDial } from './PlayDial'
import { PlayNumbers } from './PlayNumbers'
import { PlaySketch } from './PlaySketch'
import { PlayTop5 } from './PlayTop5'
import { kindOfTheDay, type DailyKind } from './rotation'
import { SetDialClue } from './SetDialClue'
import { SetNumbers } from './SetNumbers'
import { SetSketch } from './SetSketch'
import { SetTop5 } from './SetTop5'
import { SketchCard, type SketchScreen } from './SketchCard'
import { Top5Card, type Top5Screen } from './Top5Card'
import { useDaily, useDailyDial, useDailyNumbers, useDailySketch, useDailyTop5, type DailyStatus } from './useDaily'
import { WordAnswer } from './WordAnswer'
import { WordPlay } from './WordPlay'

// The Today tab's one daily puzzle. The kind comes from the date; each kind keeps its
// own card, screens and server calls. Their Word is the fallback — it carries pairing,
// so it's what shows until you're paired, and it's what shows if today's kind isn't
// set up on the server yet, so there's never a night with nothing to play.
export function TodayPuzzle({ kind = kindOfTheDay(localDate()) }: { kind?: DailyKind }) {
  const streak = useStreak()
  switch (kind) {
    case 'word': return <WordSlot streak={streak} />
    case 'dial': return <DialSlot streak={streak} />
    case 'top5': return <Top5Slot streak={streak} />
    case 'sketch': return <SketchSlot streak={streak} />
    case 'numbers': return <NumbersSlot streak={streak} />
  }
}

type Streak = { badge: ReactNode; refresh: () => void }

// The couple's streak, whichever puzzle is up. Quietly absent if the server doesn't
// have it yet (migration 0009) — Their Word's card then shows its own.
function useStreak(): Streak {
  const [n, setN] = useState<number | null>(null)
  const refresh = useCallback(() => {
    api.streak(localDate()).then(setN, () => setN(null))
  }, [])
  useEffect(() => { refresh() }, [refresh])
  return { badge: n === null ? undefined : <StreakBadge n={n} />, refresh }
}

// A puzzle's screens take the whole phone, over the tab bar.
function Overlay({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 z-40 bg-bg">{children}</div>
}

// Not paired, or this kind's functions aren't on the server: Their Word instead.
function needsFallback(status: DailyStatus<{ state: string }>): boolean {
  if (status.kind === 'error') return status.error.kind === 'setup'
  return status.kind === 'ready' && status.data.state !== 'paired'
}

function WordSlot({ streak }: { streak: Streak }) {
  const daily = useDaily()
  const [screen, setScreen] = useState<DailyScreen | null>(null)
  const close = () => { setScreen(null); void daily.refresh(); streak.refresh() }
  return (
    <>
      {screen?.kind === 'play' && (
        <Overlay><WordPlay puzzle={screen.puzzle} partner={screen.partner} question={screen.question} mine={screen.mine} onClose={close} /></Overlay>
      )}
      {screen?.kind === 'answer' && (
        <Overlay><WordAnswer partner={screen.partner} template={screen.template} question={screen.question} onClose={close} /></Overlay>
      )}
      <DailyCard daily={daily} open={setScreen} corner={streak.badge} />
    </>
  )
}

function DialSlot({ streak }: { streak: Streak }) {
  const daily = useDailyDial()
  const [screen, setScreen] = useState<DialScreen | null>(null)
  if (needsFallback(daily.status)) return <WordSlot streak={streak} />
  const close = () => { setScreen(null); void daily.refresh(); streak.refresh() }
  return (
    <>
      {screen?.kind === 'play' && <Overlay><PlayDial puzzle={screen.puzzle} partner={screen.partner} spectrum={screen.spectrum} onClose={close} /></Overlay>}
      {screen?.kind === 'answer' && <Overlay><SetDialClue partner={screen.partner} spectrum={screen.spectrum} onClose={close} /></Overlay>}
      <DialCard daily={daily} open={setScreen} corner={streak.badge} />
    </>
  )
}

function Top5Slot({ streak }: { streak: Streak }) {
  const daily = useDailyTop5()
  const [screen, setScreen] = useState<Top5Screen | null>(null)
  if (needsFallback(daily.status)) return <WordSlot streak={streak} />
  const close = () => { setScreen(null); void daily.refresh(); streak.refresh() }
  return (
    <>
      {screen?.kind === 'play' && <Overlay><PlayTop5 puzzle={screen.puzzle} partner={screen.partner} theme={screen.theme} onClose={close} /></Overlay>}
      {screen?.kind === 'answer' && <Overlay><SetTop5 partner={screen.partner} theme={screen.theme} items={screen.items} onClose={close} /></Overlay>}
      <Top5Card daily={daily} open={setScreen} corner={streak.badge} />
    </>
  )
}

function SketchSlot({ streak }: { streak: Streak }) {
  const daily = useDailySketch()
  const [screen, setScreen] = useState<SketchScreen | null>(null)
  if (needsFallback(daily.status)) return <WordSlot streak={streak} />
  const close = () => { setScreen(null); void daily.refresh(); streak.refresh() }
  return (
    <>
      {screen?.kind === 'play' && <Overlay><PlaySketch puzzle={screen.puzzle} partner={screen.partner} prompt={screen.prompt} onClose={close} /></Overlay>}
      {screen?.kind === 'answer' && <Overlay><SetSketch partner={screen.partner} prompt={screen.prompt} onClose={close} /></Overlay>}
      <SketchCard daily={daily} open={setScreen} corner={streak.badge} />
    </>
  )
}

function NumbersSlot({ streak }: { streak: Streak }) {
  const daily = useDailyNumbers()
  const [screen, setScreen] = useState<NumbersScreen | null>(null)
  if (needsFallback(daily.status)) return <WordSlot streak={streak} />
  const close = () => { setScreen(null); void daily.refresh(); streak.refresh() }
  return (
    <>
      {screen?.kind === 'play' && <Overlay><PlayNumbers puzzle={screen.puzzle} partner={screen.partner} onClose={close} /></Overlay>}
      {screen?.kind === 'answer' && <Overlay><SetNumbers partner={screen.partner} questions={screen.questions} onClose={close} /></Overlay>}
      <NumbersCard daily={daily} open={setScreen} corner={streak.badge} />
    </>
  )
}
