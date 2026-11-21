import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('an incident with coordinates shows labelled weather context, wind first for a fire', async ({ page, browser }) => {
  const latitude = (6.5 + Math.random() * 0.05).toFixed(5)
  const longitude = (3.35 + Math.random() * 0.05).toFixed(5)
  await page.goto('/report')
  await page.getByLabel(/title/i).fill(`E2E weather ${Date.now()}`)
  await page.getByLabel(/description/i).fill('Bush fire spreading towards the fence line.')
  await page.getByLabel(/^location/i).fill('Behind the estate gate, Gbagada')
  await page.getByRole('combobox', { name: /category/i }).selectOption('Fire')
  await page.getByText('Add precise coordinates (optional)').click()
  await page.getByLabel('Latitude').fill(latitude)
  await page.getByLabel('Longitude').fill(longitude)
  await page.getByRole('button', { name: /submit report/i }).click()
  const reference = ((await page.locator('p.font-mono').first().textContent()) ?? '').trim()

  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await expect(coordinator).toHaveURL(/\/dashboard$/)
  await coordinator.goto('/incidents')
  await coordinator.getByLabel('Search incidents').fill(reference)
  await coordinator.getByRole('link', { name: reference }).click()

  const weather = coordinator.locator('[aria-labelledby="weather-title"]')
  await expect(weather.getByText('Context only — not evidence of the emergency or a prediction.')).toBeVisible()
  const readingList = weather.getByLabel('Weather reading')
  await expect(readingList).toBeVisible({ timeout: 45_000 })
  await expect(weather.getByText('Recorded test fixture — not live weather')).toBeVisible()
  await expect(readingList.getByRole('term').first()).toHaveText('Wind speed (relevant to this incident type)')
  const rounded = `for ${Number(latitude).toFixed(2)}, ${Number(longitude).toFixed(2)} (within about 1 km) · location not yet verified`
  await expect(weather.getByText(/Source: Open-Meteo \(recorded fixture\) · retrieved/)).toContainText(rounded)
  await expect(weather.getByText('Weather alerts are not offered by this provider.')).toBeVisible()

  await weather.getByRole('button', { name: 'Refresh weather' }).click()
  await expect(readingList).toBeVisible()
  await coordinator.close()
})
