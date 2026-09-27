import { useEffect, useRef, useState } from 'react'
import { cardText, type CardData } from './card'
import { drawCard } from './image'
import { shareFiles } from './shareFiles'

// "Share" on a finished session: the phone's own share sheet, with the card as a picture
// and the few lines of text alongside — to WhatsApp, a Story, wherever. The picture is
// drawn as soon as this appears, so the tap goes straight to sharing (a phone only lets
// a page open its share sheet straight from a tap).
export function ShareButton({ data, className = '', label = 'Share how we did' }: { data: CardData; className?: string; label?: string }) {
  const image = useRef<Blob | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const text = cardText(data)
  const key = text // redraw only when what's on the card changes
  useEffect(() => {
    let live = true
    drawCard(data).then((b) => { if (live) image.current = b }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `data`
  }, [key])

  const share = async () => {
    setNote(null)
    const result = await shareFiles({ text, file: image.current, filename: 'coupled.png', title: 'Coupled' })
    if (result === 'copied') setNote('Copied — paste it in your chat')
    else if (result === 'saved') setNote('Image saved, and the text copied')
    else if (result === 'failed') setNote('Couldn’t share from this browser')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button onClick={() => void share()} className={'press w-full min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold inline-flex items-center justify-center gap-2 ' + className}>
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12M8 7l4-4 4 4" />
          <path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8" />
        </svg>
        {label}
      </button>
      {note && <div className="text-center text-sm font-bold text-fg/60">{note}</div>}
    </div>
  )
}
