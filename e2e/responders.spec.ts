import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('an administrator adds, finds and deactivates a responder', async ({ page }) => {
  const callSign = `E2E-${Date.now().toString(36).toUpperCase()}`.slice(0, 20)
  await signIn(page, 'admin@phantom.demo')
  await expect(page).toHaveURL(/\/incidents$/)
  await page.goto('/responders')
  await expect(page.getByText('MED-01')).toBeVisible()

  await page.getByRole('button', { name: /add responder/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Call sign').fill(callSign.toLowerCase())
  await dialog.getByLabel('Full name').fill('E2E Responder')
  await dialog.getByLabel('Team').fill('E2E Team')
  await dialog.getByLabel('Skills').fill('Rope rescue, first aid')
  await dialog.getByRole('button', { name: 'Add responder' }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByLabel('Search responders').fill(callSign)
  const row = page.getByRole('row').filter({ hasText: callSign })
  await expect(row.getByText('Available')).toBeVisible()
  // The team & skills column is hidden on narrow screens by design.
  if (test.info().project.name === 'desktop') await expect(row.getByText('rope rescue')).toBeVisible()

  await row.getByRole('button', { name: `Actions for ${callSign}` }).click()
  await page.getByRole('menuitem', { name: 'Deactivate' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click()
  await expect(row).toHaveCount(0)

  await page.getByRole('combobox', { name: /filter by active state/i }).click()
  await page.getByRole('option', { name: 'Deactivated', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: callSign }).getByText('Deactivated')).toBeVisible()
})

test('the demo responder sets their own availability from their account page', async ({ page }) => {
  await signIn(page, 'responder@phantom.demo')
  await expect(page).toHaveURL(/\/assignments$/)
  await page.goto('/account')
  const card = page.locator('[aria-labelledby="my-availability-title"]')
  await expect(card.getByText('MED-01')).toBeVisible()

  // Leave the shared demo data as it was found.
  const unavailable = card.getByRole('button', { name: 'Unavailable', exact: true })
  const available = card.getByRole('button', { name: 'Available', exact: true })
  const startedAvailable = (await available.getAttribute('aria-pressed')) === 'true'
  await (startedAvailable ? unavailable : available).click()
  await expect(startedAvailable ? unavailable : available).toHaveAttribute('aria-pressed', 'true')
  await (startedAvailable ? available : unavailable).click()
  await expect(startedAvailable ? available : unavailable).toHaveAttribute('aria-pressed', 'true')
})

test('coordinators see responders read-only', async ({ page }) => {
  await signIn(page, 'coordinator@phantom.demo')
  await expect(page).toHaveURL(/\/incidents$/)
  await page.goto('/responders')
  await expect(page.getByText('MED-01')).toBeVisible()
  await expect(page.getByRole('button', { name: /add responder/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /actions for/i })).toHaveCount(0)
})
