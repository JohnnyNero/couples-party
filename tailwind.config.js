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
    },
  },
  plugins: [],
}
