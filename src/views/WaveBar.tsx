// A spectrum, drawn as a bar between two poles. The target marker only shows to
// whoever is allowed to see it (the psychic while choosing a clue; everyone at reveal).
export function WaveBar({
  low,
  high,
  target,
  guess,
  showTarget = false,
  reveal = false,
}: {
  low: string
  high: string
  target?: number | null
  guess?: number | null
  showTarget?: boolean
  // Plays the target's entrance animation — only true for the actual reveal moment,
  // never the psychic's own private view, where it's just been sitting there.
  reveal?: boolean
}) {
  return (
    <div className="w-full">
      <div className="relative h-4 sm:h-5 bg-fg/10 border-2 border-fg/25">
        {showTarget && target != null && (
          <div
            className={'absolute top-0 bottom-0 w-2 bg-accent' + (reveal ? ' animate-drop-in' : '')}
            style={{ left: `calc(${target}% - 4px)` }}
          />
        )}
        {guess != null && (
          <div
            className="absolute -top-1.5 -bottom-1.5 w-1 bg-fg"
            style={{ left: `calc(${guess}% - 2px)` }}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between gap-2 text-[0.6rem] sm:text-sm uppercase tracking-wide text-fg/50">
        <span className="text-left">{low}</span>
        <span className="text-right">{high}</span>
      </div>
    </div>
  )
}
