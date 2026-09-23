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
      },
      animation: {
        'fade-up': 'fade-up 280ms ease-out both',
        pop: 'pop 320ms cubic-bezier(0.34,1.56,0.64,1) both',
        'reveal-pop': 'reveal-pop 380ms cubic-bezier(0.34,1.56,0.64,1) both',
        'finger-fold': 'finger-fold 420ms ease-in-out both',
        'drop-in': 'drop-in 420ms cubic-bezier(0.34,1.56,0.64,1) both',
      },
    },
  },
  plugins: [],
}
