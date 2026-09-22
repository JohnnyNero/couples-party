/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Three colours only. The accent is used ONLY to mark whose turn it is
        // / what just happened — never for decoration.
        // "Warm Blush": warm cream ground, warm-ink text, coral accent.
        bg: '#fff3ec',
        fg: '#3b241e',
        accent: '#ff6f61',
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
        'finger-fold': 'finger-fold 420ms ease-in-out both',
        'drop-in': 'drop-in 420ms cubic-bezier(0.34,1.56,0.64,1) both',
      },
    },
  },
  plugins: [],
}
