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

test('the AI panel shows an honest, clearly labelled state for a new report', async ({ page, browser }) => {
  const title = `E2E AI panel ${Date.now()}`
  await page.goto('/report')
  await page.getByLabel(/title/i).fill(title)
  await page.getByLabel(/description/i).fill('Water rising fast across the road, two cars stuck, people on the roof of one car.')
  await page.getByLabel(/^location/i).fill('Lekki-Epe Expressway near the toll gate')
  await page.getByRole('combobox', { name: /category/i }).selectOption('Flood')
  await page.getByRole('button', { name: /submit report/i }).click()
  const reference = (await page.locator('p.font-mono').first().textContent())?.trim() ?? ''

  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await coordinator.getByLabel('Search incidents').fill(reference)
  await coordinator.getByRole('link', { name: reference }).click()

  const panel = coordinator.locator('[aria-labelledby="ai-panel-title"]')
  await expect(panel.getByText('Advisory only')).toBeVisible()
  // The queue may hold older reports, so any honest state is valid: queued/analysing, a result, or a retryable failure.
  const result = panel.getByRole('table', { name: /compared with approved values/i })
  const retry = panel.getByRole('button', { name: /retry analysis/i })
  const running = panel.getByText(/analysis queued|analysing the report/i)
  await expect(result.or(retry).or(running).first()).toBeVisible()
  if (await result.isVisible()) {
    // A recommendation never becomes the approved value.
    await expect(result.getByText('Not yet assessed')).toBeVisible()
  } else if (await retry.isVisible()) {
    await expect(panel.getByText('The report and incident are unchanged', { exact: false })).toBeVisible()
  }
  await expect(coordinator.getByRole('main').locator('header').getByText('Reported', { exact: true })).toBeVisible()
  await coordinator.close()
})

test('two reports of the same event are suggested as duplicates and merged by the coordinator', async ({ page, browser }) => {
  const tag = `kx${Date.now().toString(36)}`
  const lat = (9 + Math.random()).toFixed(5)
  const lon = (7 + Math.random()).toFixed(5)

  async function report(latitude: string): Promise<string> {
    await page.goto('/report')
    await page.getByLabel(/title/i).fill(`Fire at ${tag} depot`)
    await page.getByLabel(/description/i).fill(`Flames and black smoke at the ${tag} depot gate, crowd gathering`)
    await page.getByLabel(/^location/i).fill(`${tag} depot gate`)
    await page.getByRole('combobox', { name: /category/i }).selectOption('Fire')
    await page.getByText('Add precise coordinates (optional)').click()
    await page.getByLabel('Latitude').fill(latitude)
    await page.getByLabel('Longitude').fill(lon)
    await page.getByRole('button', { name: /submit report/i }).click()
    return ((await page.locator('p.font-mono').first().textContent()) ?? '').trim()
  }

  const first = await report(lat)
  const second = await report((Number(lat) + 0.0008).toFixed(5))

  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await coordinator.getByLabel('Search incidents').fill(second)
  const row = coordinator.getByRole('row').filter({ has: coordinator.getByRole('link', { name: second }) })
  await expect(row.getByText('Possible duplicate', { exact: true })).toBeVisible()
  await row.getByRole('link', { name: second }).click()

  const panel = coordinator.locator('[aria-labelledby="relations-title"]')
  await expect(panel.getByText(/possible duplicate · \d+% match/i)).toBeVisible()
  await expect(panel.getByRole('link', { name: first })).toBeVisible()
  await panel.getByRole('button', { name: /confirm duplicate/i }).click()
  const dialog = coordinator.getByRole('dialog')
  await expect(dialog.getByRole('radio', { name: new RegExp(first) })).toBeChecked()
  await dialog.getByRole('button', { name: `Close ${second} as duplicate` }).click()

  const header = coordinator.getByRole('main').locator('header')
  await expect(header.getByText('Closed', { exact: true })).toBeVisible()
  await expect(coordinator.getByText(`Duplicate of ${first}`, { exact: true })).toBeVisible()
  await expect(panel.getByText(new RegExp(`closed as a duplicate of ${first}`, 'i'))).toBeVisible()

  await panel.getByRole('link', { name: first }).first().click()
  await expect(coordinator.getByRole('heading', { name: 'Public reports (2)' })).toBeVisible()
  await expect(coordinator.getByText('Linked report')).toBeVisible()
  await coordinator.close()
})
