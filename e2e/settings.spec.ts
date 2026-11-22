import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

// The development database is shared: always put the defaults back, even if the test fails part-way.
test.afterEach(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: 'http://localhost:5080' })
  const login = await api.post('/api/v1/auth/login', { data: { email: 'admin@phantom.demo', password } })
  const { accessToken } = (await login.json()) as { accessToken: string }
  const headers = { Authorization: `Bearer ${accessToken}` }
  const current = (await (await api.get('/api/v1/settings', { headers })).json()) as { defaults: unknown; updatedAt: string | null; isCustomised: boolean }
  if (current.isCustomised) {
    const restored = await api.put('/api/v1/settings', { headers, data: { values: current.defaults, expectedUpdatedAt: current.updatedAt } })
    expect(restored.ok()).toBe(true)
  }
  await api.dispose()
})

test('an administrator changes an operational setting, which is recorded in the audit log', async ({ page }) => {
  await signIn(page, 'admin@phantom.demo')
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto('/admin/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  const cache = page.getByLabel(/Weather cache/)
  await cache.fill('20')
  const [saved] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/v1/settings') && r.request().method() === 'PUT'),
    page.getByRole('button', { name: 'Save changes' }).click(),
  ])
  expect(saved.status()).toBe(200)
  await expect(page.getByText('Settings saved. They apply within 30 seconds.')).toBeVisible()
  await expect(page.getByText(/Some values differ from the configured defaults\. Last changed by .+ on /)).toBeVisible()
  await expect(cache).toHaveValue('20')

  await page.reload()
  await expect(page.getByLabel(/Weather cache/)).toHaveValue('20')

  await page.goto('/admin/audit')
  await page.getByRole('combobox', { name: /filter by action/i }).click()
  await page.getByRole('option', { name: 'settings.changed' }).click()
  const row = page.getByRole('row').filter({ hasText: 'settings.changed' }).first()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: /show details/i }).click()
  await expect(page.getByText(/"weatherCacheMinutes": 20/)).toBeVisible()

  // Back to the defaults through the page, as an administrator would.
  await page.goto('/admin/settings')
  await page.getByRole('button', { name: /use defaults/i }).click()
  const [restored] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/v1/settings') && r.request().method() === 'PUT'),
    page.getByRole('button', { name: 'Save changes' }).click(),
  ])
  expect(restored.status()).toBe(200)
  await expect(page.getByLabel(/Weather cache/)).toHaveValue('15')
  await expect(page.getByText(/^Using the configured defaults\. Last changed by /)).toBeVisible()
})

test('coordinators cannot reach settings', async ({ page }) => {
  await signIn(page, 'coordinator@phantom.demo')
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/admin/settings')
  await expect(page.getByText('You do not have access to this area')).toBeVisible()
})
