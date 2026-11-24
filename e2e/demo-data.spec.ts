import { expect, test, type Page } from '@playwright/test'

/** Requirement 20: seeded demonstration incidents exist and are labelled wherever they appear. */
const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('seeded demo incidents are labelled in the list, on the incident page and on the map', async ({ page }) => {
  await signIn(page, 'coordinator@phantom.demo')

  await page.goto('/incidents?status=all')
  await page.getByLabel('Search incidents').fill('Demo:')
  const row = page.getByRole('row').filter({ hasText: 'Demo: Person collapsed at a bus stop' })
  await expect(row).toBeVisible()
  await expect(row.getByText('Demo data')).toBeVisible()

  await row.getByRole('link').first().click()
  const header = page.getByRole('main').locator('header')
  await expect(header.getByText('Demo data')).toBeVisible()
  await expect(header.getByText('Verified', { exact: true })).toBeVisible()
  // The seeded history reads like a real one, attributed to the Demo Coordinator.
  const history = page.getByRole('list', { name: 'Incident history' })
  await expect(history.getByRole('listitem').filter({ hasText: 'Status changed from Under review to Verified' })).toContainText('Demo Coordinator')

  await page.goto('/map?status=all')
  const list = page.getByRole('list', { name: 'Incidents on the map' })
  await expect(list.getByRole('button').filter({ hasText: 'Demo: Smoke from a market stall' }).getByText('Demo data')).toBeVisible()
})
