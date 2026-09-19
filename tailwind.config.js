/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Three colours only. The accent is used ONLY to mark whose turn it is
        // / what just happened — never for decoration.
        // Romantic + vibrant: deep aubergine ground, warm blush ink, hot-rose accent.
        bg: '#1a0b16',
        fg: '#ffe9ee',
        accent: '#ff2e63',
      },
      fontFamily: {
        // Make Space Grotesk the default everywhere (preflight sets `sans` on html)
        // as well as the explicit board face.
        sans: ['"Space Grotesk"', 'Arial', 'sans-serif'],
        board: ['"Space Grotesk"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
