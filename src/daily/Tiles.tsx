import { WORD_LENGTH, type Mark } from './wordle'

// One row of five letter tiles. Coloured with the app's own three colours rather than
// Wordle's green and yellow: solid coral is right place, a coral outline is in the word
// but somewhere else, grey is not in it at all.
export function TileRow({
  letters,
  pattern,
  active = false,
  reveal = false,
  size = 'lg',
}: {
  letters: string
  pattern?: string
  active?: boolean
  reveal?: boolean
  size?: 'lg' | 'sm'
}) {
  const box = size === 'lg' ? 'w-14 h-14 text-3xl' : 'w-7 h-7 text-sm rounded-md'
  return (
    <div className="flex justify-center gap-1.5">
      {Array.from({ length: WORD_LENGTH }, (_, i) => {
        const letter = letters[i] ?? ''
        const mark = pattern?.[i] as Mark | undefined
        return (
          <div
            key={i}
            style={reveal && mark ? { animationDelay: `${i * 120}ms` } : undefined}
            className={
              `${box} grid place-items-center rounded-lg font-bold uppercase border-2 ` +
              (mark === 'g'
                ? 'bg-accent border-accent text-bg'
                : mark === 'y'
                  ? 'bg-accent/15 border-accent text-fg'
                  : mark === '.'
                    ? 'bg-fg/15 border-transparent text-fg/60'
                    : letter
                      ? 'border-fg/50 text-fg'
                      : active
                        ? 'border-fg/25'
                        : 'border-fg/10') +
              (reveal && mark ? ' animate-reveal-pop' : '') +
              (letter && !mark ? ' animate-pop' : '')
            }
          >
            {letter}
          </div>
        )
      })}
    </div>
  )
}

export function Keyboard({
  onKey,
  states,
  disabled = false,
}: {
  onKey: (key: string) => void
  states?: Map<string, Mark>
  disabled?: boolean
}) {
  const rows = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-']
  return (
    <div className="flex flex-col gap-1.5 w-full max-w-md mx-auto select-none">
      {rows.map((row) => (
        <div key={row} className="flex justify-center gap-1">
          {[...row].map((k) => {
            const wide = k === '+' || k === '-'
            const mark = states?.get(k)
            return (
              <button
                key={k}
                type="button"
                disabled={disabled}
                onClick={() => onKey(k === '+' ? 'Enter' : k === '-' ? 'Backspace' : k)}
                className={
                  'h-12 rounded-md font-bold uppercase active:translate-y-px disabled:opacity-50 ' +
                  (wide ? 'px-2 text-[0.65rem] tracking-wider flex-[1.5]' : 'flex-1 text-base') +
                  ' ' +
                  (mark === 'g'
                    ? 'bg-accent text-bg'
                    : mark === 'y'
                      ? 'bg-accent/20 text-fg ring-2 ring-inset ring-accent'
                      : mark === '.'
                        ? 'bg-fg/5 text-fg/25'
                        : 'bg-fg/10 text-fg')
                }
              >
                {k === '+' ? 'Enter' : k === '-' ? '⌫' : k}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
