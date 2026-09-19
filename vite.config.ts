import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// On GitHub Pages the app is served from https://<user>.github.io/couples-party/,
// so production builds need that base path. Dev stays at "/" so the local
// play-test (npm run dev) is reachable at http://localhost:5173/.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/couples-party/' : '/',
  plugins: [react()],
}))
