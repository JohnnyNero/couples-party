export function PlayWaiting({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center p-8 text-center">
      <div className="text-lg sm:text-2xl uppercase tracking-wide text-fg/55">{label}</div>
    </div>
  )
}
