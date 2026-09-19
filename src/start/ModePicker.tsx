import type { PlayMode } from './mode'

export function ModePicker({ onPick }: { onPick: (m: PlayMode) => void }) {
  return (
    <div className="h-full w-full flex flex-col select-none p-6 sm:p-10">
      <div className="text-sm sm:text-lg uppercase tracking-[0.25em] text-fg/70 border-b-2 border-fg/80 pb-3">
        Couples Party
      </div>
      <div className="flex-1 flex flex-col justify-center gap-4 w-full max-w-xl mx-auto">
        <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-1">
          How are you playing?
        </div>
        <PickButton
          onClick={() => onPick('screen')}
          title="With a TV or laptop"
          sub="This screen is the board · two phones are the controllers"
        />
        <PickButton
          onClick={() => onPick('duo')}
          title="Just two phones"
          sub="No shared screen · each phone shows the board and your controls"
        />
      </div>
      <div className="text-xs uppercase tracking-widest text-fg/30 border-t-2 border-fg/80 pt-3">
        Greybox · Mind Meld
      </div>
    </div>
  )
}

function PickButton({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
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
