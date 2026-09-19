import type { SessionState } from '../../engine/state'

export function ScreenPotShuffle({ s }: { s: SessionState }) {
  const n = s.forfeits.length
  return (
    <div className="w-full text-center">
      <style>{`
        @keyframes cp-drop { from { transform: translateY(-60px) rotate(var(--r)); opacity: 0 } to { transform: translateY(0) rotate(var(--r)); opacity: 1 } }
      `}</style>
      <div className="relative h-40 sm:h-56 flex items-center justify-center">
        {Array.from({ length: n }).map((_, i) => (
          <div
            key={i}
            className="absolute h-28 w-20 sm:h-40 sm:w-28 border-2 border-fg/70 bg-bg"
            style={{
              // deterministic scatter so it reads as a pile, not a fan
              ['--r' as string]: `${((i * 37) % 13) - 6}deg`,
              transform: `translateX(${((i * 29) % 40) - 20}px) rotate(${((i * 37) % 13) - 6}deg)`,
              animation: `cp-drop 400ms ease-out ${i * 90}ms both`,
            }}
          />
        ))}
      </div>
      <div className="mt-6 text-3xl sm:text-5xl font-bold uppercase tracking-tight">Pot {n}</div>
    </div>
  )
}
