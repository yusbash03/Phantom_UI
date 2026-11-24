import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Task 36: automated accessibility and responsive checks on every main screen, on both projects (desktop and
 * Pixel 7). axe-core finds about a third of WCAG issues automatically; it complements, not replaces, the
 * keyboard and screen-reader behaviour already asserted by role-based queries throughout the other specs.
 */
const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')
test.setTimeout(180_000)

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** Serious and critical WCAG 2.1 A/AA violations fail the test; the rest are reported in the message. */
async function expectAccessible(page: Page, screen: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Mapbox draws the map on a canvas with its own controls; it is covered by the keyboard-operable marker list.
    .exclude('.mapboxgl-canvas-container')
    .analyze()
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const summary = results.violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(' ')}`)
  expect(blocking, `${screen}:\n${summary.join('\n')}`).toEqual([])
}

/** No sideways scrolling: content must fit the viewport, including on a phone. */
async function expectNoHorizontalScroll(page: Page, screen: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `${screen} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1)
}

/** Under `vite preview` (production build with the Vercel headers) any Content-Security-Policy violation fails. */
const cspViolations = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
  const found: string[] = []
  cspViolations.set(page, found)
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) found.push(message.text())
  })
})

test.afterEach(({ page }) => {
  expect(cspViolations.get(page) ?? [], 'Content-Security-Policy violations').toEqual([])
})

async function check(page: Page, path: string, ready: (page: Page) => Promise<void>) {
  await page.goto(path)
  await ready(page)
  await expectAccessible(page, path)
  await expectNoHorizontalScroll(page, path)
}

test('public screens are accessible and fit the screen', async ({ page }) => {
  await check(page, '/report', (p) => expect(p.getByRole('heading', { name: /report an incident/i })).toBeVisible())
  await check(page, '/report/status', (p) => expect(p.getByRole('button', { name: 'Check status' })).toBeVisible())
  await check(page, '/login', (p) => expect(p.getByRole('button', { name: 'Sign in' })).toBeVisible())
})

test('coordinator screens are accessible and fit the screen', async ({ page }) => {
  await signIn(page, 'coordinator@phantom.demo')
  await check(page, '/dashboard', (p) => expect(p.getByRole('region', { name: 'Key figures' }).locator('p.text-2xl').first()).toBeVisible())
  await check(page, '/incidents', (p) => expect(p.locator('tbody tr').first()).toBeVisible())
  const first = page.locator('tbody tr').first().getByRole('link').first()
  await first.click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('[aria-labelledby="ai-panel-title"]')).toBeVisible()
  await expectAccessible(page, 'incident detail')
  await expectNoHorizontalScroll(page, 'incident detail')
  await check(page, '/map', (p) => expect(p.getByRole('heading', { name: 'Operations map' })).toBeVisible())
  await check(page, '/reports', (p) => expect(p.getByRole('table', { name: 'By category' })).toBeVisible())
  await check(page, '/responders', (p) => expect(p.getByRole('heading', { name: /responders/i }).first()).toBeVisible())
  await check(page, '/notifications', (p) => expect(p.getByRole('heading', { name: /notifications/i }).first()).toBeVisible())
})

test('administrator screens are accessible and fit the screen', async ({ page }) => {
  await signIn(page, 'admin@phantom.demo')
  await check(page, '/admin/users', (p) => expect(p.locator('tbody tr').first()).toBeVisible())
  await check(page, '/admin/audit', (p) => expect(p.locator('tbody tr').first()).toBeVisible())
  await check(page, '/admin/settings', (p) => expect(p.getByLabel(/Weather cache/)).toBeVisible())
})

test('responder screens are accessible and fit the screen', async ({ page }) => {
  await signIn(page, 'responder@phantom.demo')
  await check(page, '/assignments', (p) => expect(p.getByRole('heading', { name: /my assignments/i })).toBeVisible())
  await check(page, '/account', (p) => expect(p.getByRole('heading', { name: /account/i }).first()).toBeVisible())
})
