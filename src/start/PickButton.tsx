import type { ReactNode } from 'react'

// Shared layout for the launch pickers (how to play, what to play): a title bar, a
// column of choice buttons, and a footer. Pulled out once a second picker needed it.
export function PickerScreen({ prompt, children }: { prompt: string; children: ReactNode }) {
  return (
    <div className="h-full w-full flex flex-col select-none p-6 sm:p-10">
      <div className="text-sm sm:text-lg uppercase tracking-[0.25em] text-fg/70 border-b-2 border-fg/80 pb-3">
        Couples Party
      </div>
      <div className="flex-1 flex flex-col justify-center gap-4 w-full max-w-xl mx-auto">
        <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-1">{prompt}</div>
        {children}
      </div>
      <div className="text-xs uppercase tracking-widest text-fg/30 border-t-2 border-fg/80 pt-3">
        Greybox · a couples game night
      </div>
    </div>
  )
}

export function PickButton({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left border-2 border-fg/80 p-5 sm:p-6 transition-colors hover:border-accent hover:bg-accent hover:text-bg active:translate-y-px"
    >
      <div className="text-2xl sm:text-3xl font-bold uppercase tracking-tight">{title}</div>
      <div className="mt-1 text-sm sm:text-base uppercase tracking-wide text-fg/50 group-hover:text-bg/70">
        {sub}
      </div>
    </button>
  )
}
