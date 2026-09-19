/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Three colours only. The accent is used ONLY to mark whose turn it is
        // / what just happened — never for decoration.
        bg: '#0d0d0f',
        fg: '#f4f3ee',
        accent: '#f5d000',
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
