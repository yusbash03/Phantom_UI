/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiTarget = process.env.PHANTOM_API_URL ?? 'http://localhost:5080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin in development: the refresh cookie stays first-party (architecture steering).
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
      '/hubs': { target: apiTarget, ws: true, changeOrigin: false },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Interaction-heavy tests (many simulated keystrokes and Radix menus) exceed the 5 s default when the
    // machine is busy; the budget only affects timing, never what is asserted.
    testTimeout: 15_000,
  },
})
