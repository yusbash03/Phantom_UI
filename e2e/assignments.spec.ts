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

test('a coordinator assigns the demo responder, who works the assignment through to completion', async ({ page, browser }) => {
  const title = `E2E assignment ${Date.now()}`

  // A public report, verified by the coordinator.
  await page.goto('/report')
  await page.getByLabel(/title/i).fill(title)
  await page.getByLabel(/description/i).fill('Gas cylinder fire behind the restaurant, kitchen staff evacuated.')
  await page.getByLabel(/^location/i).fill('Admiralty Way, Lekki Phase 1')
  await page.getByRole('combobox', { name: /category/i }).selectOption('Fire')
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
  const verify = coordinator.getByRole('dialog')
  await verify.getByRole('combobox').click()
  await coordinator.getByRole('option', { name: 'High' }).click()
  await verify.getByRole('button', { name: 'Verify incident' }).click()
  await expect(header.getByText('Verified', { exact: true })).toBeVisible()

  // Assign MED-01 (the demo responder). If an earlier run left them busy, override as a coordinator would.
  await coordinator.getByRole('button', { name: 'Assign responder' }).click()
  const assign = coordinator.getByRole('dialog')
  await assign.getByRole('radio', { name: /MED-01/ }).check()
  const override = assign.getByLabel(/override reason/i)
  if (await override.isVisible()) await override.fill('E2E: reusing the demo responder.')
  await assign.getByRole('button', { name: 'Assign' }).click()
  await expect(header.getByText('Assigned', { exact: true })).toBeVisible()
  const panel = coordinator.locator('[aria-labelledby="assignments-title"]')
  await expect(panel.getByText('MED-01')).toBeVisible()

  // The responder works it from My assignments.
  const responder = await browser.newPage()
  await signIn(responder, 'responder@phantom.demo')
  await expect(responder).toHaveURL(/\/assignments$/)
  const card = responder.getByRole('article', { name: `Assignment MED-01 to ${reference}` })
  await expect(card.getByText(title)).toBeVisible()
  await card.getByRole('button', { name: 'Acknowledge' }).click()
  await card.getByRole('button', { name: 'On my way' }).click()
  await expect(card.getByText('En route', { exact: true })).toBeVisible()

  await card.getByRole('button', { name: 'Post update' }).click()
  await responder.getByRole('dialog').getByLabel('Update').fill('Five minutes out, two fire extinguishers on board.')
  await responder.getByRole('dialog').getByRole('button', { name: 'Post update' }).click()
  await expect(card.getByText('Five minutes out, two fire extinguishers on board.')).toBeVisible()

  await card.getByRole('button', { name: 'Arrived on scene' }).click()
  await card.getByRole('button', { name: 'Complete' }).click()
  await responder.getByRole('dialog').getByLabel('Resolution notes').fill('Fire out, cylinder removed, premises ventilated.')
  await responder.getByRole('dialog').getByRole('button', { name: 'Complete assignment' }).click()
  await expect(card.getByText('Completed', { exact: true })).toBeVisible()

  // The coordinator sees the outcome; resolving the incident is still their decision.
  await coordinator.reload()
  await expect(header.getByText('In progress', { exact: true })).toBeVisible()
  await expect(panel.getByText('Completed', { exact: true })).toBeVisible()
  await expect(panel.getByText('Resolution notes: Fire out, cylinder removed, premises ventilated.')).toBeVisible()
  await expect(panel.getByText('Five minutes out, two fire extinguishers on board.')).toBeVisible()
  await expect(coordinator.getByRole('button', { name: 'Resolve' })).toBeVisible()

  await responder.close()
  await coordinator.close()
})
