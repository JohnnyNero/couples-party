// A placeholder while something loads: a few soft bars with a sheen passing over them,
// roughly the shape of what's coming, instead of a blinking "…".
export function Loading({ className = 'h-24', lines = 3 }: { className?: string; lines?: number }) {
  const bar = 'rounded-full bg-[linear-gradient(90deg,rgb(var(--fg)/0.06)_0%,rgb(var(--fg)/0.14)_50%,rgb(var(--fg)/0.06)_100%)] bg-[length:200%_100%] animate-shimmer'
  return (
    <div className={'flex flex-col justify-center gap-2.5 ' + className} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={bar + ' h-3'} style={{ width: `${[88, 64, 76, 52][i % 4]}%`, animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  )
}
