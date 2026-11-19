import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('a public report reaches the coordinator, who reviews and verifies it', async ({ page, browser }) => {
  const title = `E2E transformer fire ${Date.now()}`

  // Member of the public, no account.
  await page.goto('/report')
  await page.getByLabel(/title/i).fill(title)
  await page.getByLabel(/description/i).fill('Sparks and smoke from the pole transformer on the corner.')
  await page.getByLabel(/^location/i).fill('Corner of Allen Avenue and Opebi Road')
  await page.getByRole('combobox', { name: /category/i }).selectOption('Fire')
  await page.getByRole('button', { name: /submit report/i }).click()
  const reference = (await page.locator('p.font-mono').first().textContent())?.trim() ?? ''
  expect(reference).toMatch(/^PH-\d{4}-\d{6}$/)

  // Coordinator triages it.
  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await expect(coordinator).toHaveURL(/\/incidents$/)
  await coordinator.getByLabel('Search incidents').fill(reference)
  await coordinator.getByRole('link', { name: reference }).click()
  await expect(coordinator.getByRole('heading', { name: title })).toBeVisible()
  const summary = coordinator.getByRole('main').locator('header')
  await expect(summary.getByText('Reported', { exact: true })).toBeVisible()

  await coordinator.getByRole('button', { name: 'Start review' }).click()
  await expect(summary.getByText('Under review', { exact: true })).toBeVisible()

  await coordinator.getByRole('button', { name: 'Verify' }).click()
  const dialog = coordinator.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Verify incident' }).click()
  await expect(dialog.getByText('Choose an approved severity.')).toBeVisible()
  await dialog.getByRole('combobox').click()
  await coordinator.getByRole('option', { name: 'High' }).click()
  await dialog.getByRole('button', { name: 'Verify incident' }).click()

  await expect(summary.getByText('Verified', { exact: true })).toBeVisible()
  await expect(summary.getByLabel('High severity')).toBeVisible()
  await expect(coordinator.getByRole('button', { name: 'Resolve' })).toBeVisible()

  // The reporter only ever sees the coarse status.
  await page.goto(`/report/status?ref=${reference}`)
  await expect(page.getByText('Under review', { exact: true })).toBeVisible()
  await coordinator.close()
})

test('administrators can read incidents but not decide them', async ({ page }) => {
  await signIn(page, 'admin@phantom.demo')
  await expect(page).toHaveURL(/\/incidents$/)
  await page.getByLabel('Filter by status').click()
  await page.getByRole('option', { name: 'All statuses' }).click()
  const first = page.locator('tbody tr').first()
  await expect(first).toBeVisible()
  await first.getByRole('link').click()
  await expect(page.getByText('Public reports', { exact: false })).toBeVisible()
  for (const action of ['Start review', 'Verify', 'Reject', 'Resolve']) {
    await expect(page.getByRole('button', { name: action })).toHaveCount(0)
  }
})
