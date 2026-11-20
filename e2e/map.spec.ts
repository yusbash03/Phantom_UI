import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('the operations map plots a reported incident with an honest, selectable marker', async ({ page, browser }) => {
  const title = `E2E map ${Date.now()}`
  // Spread runs out so earlier test incidents do not sit exactly under this marker.
  const latitude = (6.44 + Math.random() * 0.02).toFixed(5)
  const longitude = (3.42 + Math.random() * 0.02).toFixed(5)
  await page.goto('/report')
  await page.getByLabel(/title/i).fill(title)
  await page.getByLabel(/description/i).fill('Burst water main flooding the junction near the bank.')
  await page.getByLabel(/^location/i).fill('Awolowo Road junction, Ikoyi')
  await page.getByRole('combobox', { name: /category/i }).selectOption('Infrastructure')
  await page.getByText('Add precise coordinates (optional)').click()
  await page.getByLabel('Latitude').fill(latitude)
  await page.getByLabel('Longitude').fill(longitude)
  await page.getByRole('button', { name: /submit report/i }).click()
  const reference = ((await page.locator('p.font-mono').first().textContent()) ?? '').trim()

  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await expect(coordinator).toHaveURL(/\/dashboard$/)
  await coordinator.goto('/map')

  await expect(coordinator.getByRole('heading', { name: 'Operations map' })).toBeVisible()
  await expect(coordinator.getByText('Map unavailable')).toHaveCount(0)
  await expect(coordinator.locator('canvas.mapboxgl-canvas')).toBeVisible()

  const marker = coordinator.getByRole('button', { name: new RegExp(`^${reference}, Infrastructure, .*unverified location \\(reporter-supplied, unverified\\)`) })
  await expect(marker).toBeVisible()
  // Keyboard activation: markers must be operable without a pointer, and nearby markers may overlap.
  await marker.focus()
  await marker.press('Enter')

  const details = coordinator.locator('[aria-labelledby="selected-incident-title"]')
  await expect(details.getByRole('heading', { name: title })).toBeVisible()
  await expect(details.getByText('Reporter-supplied, unverified')).toBeVisible()
  await expect(details.getByText(`${Number(latitude)}, ${Number(longitude)}`, { exact: false })).toBeVisible()

  await details.getByRole('link', { name: 'Open incident' }).click()
  await expect(coordinator.getByRole('heading', { name: title })).toBeVisible()
  await coordinator.close()
})

test('responders do not see the operations map', async ({ page }) => {
  await signIn(page, 'responder@phantom.demo')
  await expect(page).toHaveURL(/\/assignments$/)
  await expect(page.getByRole('link', { name: 'Operations map' })).toHaveCount(0)
  await page.goto('/map')
  await expect(page.getByText('You do not have access to this area')).toBeVisible()
})
