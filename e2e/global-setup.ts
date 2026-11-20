import type { FullConfig } from '@playwright/test'

/**
 * Warms the stack before the first tests. The development database is remote (Neon): right after the
 * API starts, each parallel request opens a new connection and the first ones can take 10-20 s, which
 * made whichever tests ran first fail. A few parallel sign-ins open the pool's connections up front.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5173'
  const password = process.env.PHANTOM_DEMO_PASSWORD
  if (!password) return

  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const ready = await fetch('http://localhost:5080/health/ready').then((r) => r.ok).catch(() => false)
    if (ready) break
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  const signIn = () =>
    fetch(`${baseURL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'responder@phantom.demo', password }),
    }).catch(() => undefined)
  await Promise.all(Array.from({ length: 6 }, signIn))
}
