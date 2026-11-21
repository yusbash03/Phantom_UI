import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')
// Several people and screens in one flow against a remote database: give it room on a slow run.
test.setTimeout(120_000)

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('the incident history shows every step, AI marked as AI, and admins can find the decision in the audit log', async ({ page, browser }) => {
  const title = `E2E history ${Date.now()}`
  await page.goto('/report')
  await page.getByLabel(/title/i).fill(title)
  await page.getByLabel(/description/i).fill('Burst water main flooding the junction.')
  await page.getByLabel(/^location/i).fill('Adeola Odeku Street, Victoria Island')
  await page.getByRole('combobox', { name: /category/i }).selectOption('Flood')
  await page.getByRole('button', { name: /submit report/i }).click()
  const reference = ((await page.locator('p.font-mono').first().textContent()) ?? '').trim()

  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await expect(coordinator).toHaveURL(/\/dashboard$/)
  await coordinator.goto('/incidents')
  await coordinator.getByLabel('Search incidents').fill(reference)
  await coordinator.getByRole('link', { name: reference }).click()
  const header = coordinator.getByRole('main').locator('header')
  await coordinator.getByRole('button', { name: 'Start review' }).click()
  await expect(header.getByText('Under review', { exact: true })).toBeVisible()
  await coordinator.getByRole('button', { name: 'Verify', exact: true }).click()
  await coordinator.getByRole('dialog').getByRole('combobox').click()
  await coordinator.getByRole('option', { name: 'High' }).click()
  await coordinator.getByRole('dialog').getByRole('button', { name: 'Verify incident' }).click()
  await expect(header.getByText('Verified', { exact: true })).toBeVisible()
  const incidentUrl = coordinator.url()
  const incidentId = incidentUrl.split('/').at(-1)!

  const history = coordinator.getByRole('list', { name: 'Incident history' })
  await expect(history.getByText(`Public report ${reference} received`)).toBeVisible()
  const ai = history.getByRole('listitem').filter({ hasText: /AI analysis queued/ })
  await expect(ai.getByText('AI', { exact: true })).toBeVisible()
  const verified = history.getByRole('listitem').filter({ hasText: 'Status changed from Under review to Verified' })
  await expect(verified).toContainText('Approved severity: High')
  await expect(verified).toContainText('Coordinator')
  await coordinator.close()

  await signIn(page, 'admin@phantom.demo')
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto('/admin/audit')
  await page.getByLabel('Entity ID').fill(incidentId)
  await page.getByRole('combobox', { name: /filter by action/i }).click()
  await page.getByRole('option', { name: 'incident.status_changed' }).click()
  const rows = page.getByRole('row').filter({ hasText: 'incident.status_changed' })
  await expect(rows).toHaveCount(2)
  await rows.first().getByRole('button', { name: /show details/i }).click()
  await expect(page.getByText(/"status": "Verified"/)).toBeVisible()
})
