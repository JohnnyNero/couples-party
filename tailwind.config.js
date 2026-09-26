/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Three colours only. The accent is used ONLY to mark whose turn it is
        // / what just happened — never for decoration.
        // "Warm Blush" by day: warm cream ground, warm-ink text, coral accent. The
        // actual values are CSS variables (index.css) so night mode can swap all three
        // at once; the <alpha-value> form keeps every `text-fg/40` working.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        // Not a fourth colour — the inverted surface (dark cards, input fields). By day
        // it IS fg-on-bg flipped; by night it stays a dark surface instead of flipping
        // to a bright cream slab in a dark room.
        ink: 'rgb(var(--ink) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        // Their Word's own three, matching NYT Wordle rather than the app's accent —
        // see index.css.
        correct: 'rgb(var(--correct) / <alpha-value>)',
        present: 'rgb(var(--present) / <alpha-value>)',
        absent: 'rgb(var(--absent) / <alpha-value>)',
        // The accent as TEXT: the fill colour is too light to read as small type on the
        // cream, so words in the accent use this deeper shade.
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        // A raised surface: white by day, a warm dark card by night.
        card: 'rgb(var(--card) / <alpha-value>)',
        // The two of you. Seat A is coral, seat B is blue, on both phones and the TV:
        // avatars, scores, and whose answer is whose. `-ink` for text, `-soft` for tints.
        pa: 'rgb(var(--pa) / <alpha-value>)',
        'pa-ink': 'rgb(var(--pa-ink) / <alpha-value>)',
        'pa-soft': 'rgb(var(--pa-soft) / <alpha-value>)',
        pb: 'rgb(var(--pb) / <alpha-value>)',
        'pb-ink': 'rgb(var(--pb-ink) / <alpha-value>)',
        'pb-soft': 'rgb(var(--pb-soft) / <alpha-value>)',
        // Two more tints for game tiles, so every game isn't coral or blue.
        'tan-soft': 'rgb(var(--tan-soft) / <alpha-value>)',
        'tan-ink': 'rgb(var(--tan-ink) / <alpha-value>)',
        'sage-soft': 'rgb(var(--sage-soft) / <alpha-value>)',
        'sage-ink': 'rgb(var(--sage-ink) / <alpha-value>)',
      },
      fontFamily: {
        // Nunito everywhere by default (preflight sets `sans` on html); `display`
        // is for headings/titles only — applied screen by screen, not globally.
        sans: ['Nunito', 'Arial', 'sans-serif'],
        board: ['Nunito', 'Arial', 'sans-serif'],
        display: ['"Baloo 2"', 'Nunito', 'Arial', 'sans-serif'],
      },
      keyframes: {
        // A new phase or round settling in.
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Something just locked in — a dot filling, a score landing.
        pop: {
          '0%': { transform: 'scale(0.7)', opacity: '0.4' },
          '60%': { transform: 'scale(1.12)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        // A value held back behind a delay, then landing — starts fully hidden, unlike
        // `pop`, so nothing leaks while the delay runs.
        'reveal-pop': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // A finger going down.
        'finger-fold': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '45%': { transform: 'rotate(-30deg) scale(0.8)' },
          '100%': { transform: 'rotate(0deg) scale(1)' },
        },
        // The hidden target dropping onto the board at reveal.
        'drop-in': {
          '0%': { transform: 'translateY(-10px) scale(0.5)', opacity: '0' },
          '70%': { transform: 'translateY(1px) scale(1.1)', opacity: '1' },
          '100%': { transform: 'translateY(0) scale(1)' },
        },
        // A hidden card turning over to show what's on it.
        'flip-in': {
          '0%': { transform: 'perspective(700px) rotateY(95deg) scale(0.9)', opacity: '0' },
          '55%': { transform: 'perspective(700px) rotateY(-14deg) scale(1.04)', opacity: '1' },
          '80%': { transform: 'perspective(700px) rotateY(5deg) scale(1)' },
          '100%': { transform: 'perspective(700px) rotateY(0) scale(1)', opacity: '1' },
        },
        // The verdict landing: dropped from a height, a squash, and settled.
        slam: {
          '0%': { transform: 'scale(2.1) rotate(-5deg)', opacity: '0' },
          '50%': { transform: 'scale(0.88) rotate(1.5deg)', opacity: '1' },
          '70%': { transform: 'scale(1.07) rotate(-0.5deg)' },
          '100%': { transform: 'scale(1) rotate(0)', opacity: '1' },
        },
        // A miss: arrives, then a rueful little wobble.
        wiggle: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '20%': { transform: 'scale(1)', opacity: '1' },
          '35%': { transform: 'rotate(-6deg)' },
          '50%': { transform: 'rotate(5deg)' },
          '65%': { transform: 'rotate(-3deg)' },
          '80%': { transform: 'rotate(1.5deg)' },
          '100%': { transform: 'rotate(0)', opacity: '1' },
        },
        // Points, rising off whatever earned them and fading.
        'float-up': {
          '0%': { transform: 'translateY(6px) scale(0.5)', opacity: '0' },
          '18%': { transform: 'translateY(0) scale(1.2)', opacity: '1' },
          '30%': { transform: 'translateY(-2px) scale(1)', opacity: '1' },
          '75%': { opacity: '1' },
          '100%': { transform: 'translateY(-30px) scale(1)', opacity: '0' },
        },
        // …or dropping down off the header (there's nowhere to rise to up there).
        'float-down': {
          '0%': { transform: 'translateY(-4px) scale(0.5)', opacity: '0' },
          '18%': { transform: 'translateY(0) scale(1.2)', opacity: '1' },
          '30%': { transform: 'translateY(2px) scale(1)', opacity: '1' },
          '75%': { opacity: '1' },
          '100%': { transform: 'translateY(22px) scale(1)', opacity: '0' },
        },
        // A number that just went up.
        bump: {
          '0%, 100%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.45)' },
        },
        // Two matching cards knocking together.
        'nudge-r': {
          '0%, 100%': { transform: 'translateX(0)' },
          '40%': { transform: 'translateX(14px) rotate(3deg)' },
        },
        'nudge-l': {
          '0%, 100%': { transform: 'translateX(0)' },
          '40%': { transform: 'translateX(-14px) rotate(-3deg)' },
        },
        // The crown hopping onto a new leader.
        'crown-hop': {
          '0%': { transform: 'translateY(-14px) scale(0.4) rotate(-25deg)', opacity: '0' },
          '55%': { transform: 'translateY(2px) scale(1.15) rotate(8deg)', opacity: '1' },
          '75%': { transform: 'translateY(-2px) scale(0.95) rotate(-3deg)' },
          '100%': { transform: 'translateY(0) scale(1) rotate(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 280ms ease-out both',
        pop: 'pop 320ms cubic-bezier(0.34,1.56,0.64,1) both',
        'reveal-pop': 'reveal-pop 380ms cubic-bezier(0.34,1.56,0.64,1) both',
        'finger-fold': 'finger-fold 420ms ease-in-out both',
        'drop-in': 'drop-in 420ms cubic-bezier(0.34,1.56,0.64,1) both',
        'flip-in': 'flip-in 560ms ease-out both',
        slam: 'slam 560ms cubic-bezier(0.2,0.8,0.3,1) both',
        wiggle: 'wiggle 800ms ease-in-out both',
        'float-up': 'float-up 1500ms ease-out both',
        'float-down': 'float-down 1500ms ease-out both',
        bump: 'bump 450ms cubic-bezier(0.34,1.56,0.64,1)',
        'nudge-r': 'nudge-r 420ms ease-in-out both',
        'nudge-l': 'nudge-l 420ms ease-in-out both',
        'crown-hop': 'crown-hop 600ms cubic-bezier(0.34,1.56,0.64,1) both',
      },
    },
  },
  plugins: [],
}
