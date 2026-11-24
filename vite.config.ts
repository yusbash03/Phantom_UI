/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiTarget = process.env.PHANTOM_API_URL ?? 'http://localhost:5080'
const proxy = {
  '/api': { target: apiTarget, changeOrigin: false },
  '/hubs': { target: apiTarget, ws: true, changeOrigin: false },
}

/** `vite preview` serves the production build with the same security headers as Vercel, so they can be tested. */
const vercel = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'vercel.json'), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const productionHeaders = Object.fromEntries(vercel.headers[0]!.headers.map((h) => [h.key, h.value]))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin in development: the refresh cookie stays first-party (architecture steering).
    proxy,
  },
  preview: {
    port: 5173,
    strictPort: true,
    proxy,
    headers: productionHeaders,
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
