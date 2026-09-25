// The handful of shapes every screen is built from, so a button on one game looks like a
// button on every other.

// A raised card: ink border, soft offset shadow. `quiet` for things already done.
export const card = 'rounded-3xl border-2 border-fg bg-card shadow-[4px_4px_0_rgba(0,0,0,0.12)]'
export const quietCard = 'rounded-3xl border-2 border-fg/15'

const btnBase =
  'min-h-[56px] w-full rounded-2xl font-display font-extrabold text-xl tracking-wide active:translate-y-px disabled:opacity-40 transition-transform'
// The main thing to do on this screen.
export const btnPrimary = `${btnBase} bg-fg text-bg`
// The one big "go": start, play, send.
export const btnAccent = `${btnBase} bg-pa text-white`
// The other choice.
export const btnOutline = `${btnBase} border-2 border-fg bg-card text-fg`

// Small caps labels above things.
export const eyebrow = 'text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50'

// A text box: white card, ink edge, coral when you're in it.
export const field =
  'w-full min-h-[56px] rounded-2xl border-2 border-fg bg-card px-4 text-xl font-bold outline-none focus:border-pa placeholder:text-fg/30 placeholder:font-semibold disabled:opacity-60'
