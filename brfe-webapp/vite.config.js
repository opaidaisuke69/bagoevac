import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // Dev server runs at the root ("/"); production is served under "/brfe-webapp/".
  base: command === 'build' ? '/brfe-webapp/' : '/',
  server: {
    port: 5173,
  },
}))
