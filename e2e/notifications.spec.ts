import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('assignment and decline notifications reach the right people and lead to the right screens', async ({ page, browser }) => {
  const title = `E2E notification ${Date.now()}`
  await page.goto('/report')
  await page.getByLabel(/title/i).fill(title)
  await page.getByLabel(/description/i).fill('Fallen power line across the road, sparking.')
  await page.getByLabel(/^location/i).fill('Ozumba Mbadiwe Avenue, Victoria Island')
  await page.getByRole('combobox', { name: /category/i }).selectOption('Infrastructure')
  await page.getByRole('button', { name: /submit report/i }).click()
  const reference = ((await page.locator('p.font-mono').first().textContent()) ?? '').trim()

  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await coordinator.getByLabel('Search incidents').fill(reference)
  await coordinator.getByRole('link', { name: reference }).click()
  const header = coordinator.getByRole('main').locator('header')
  await coordinator.getByRole('button', { name: 'Start review' }).click()
  await expect(header.getByText('Under review', { exact: true })).toBeVisible()
  await coordinator.getByRole('button', { name: 'Verify', exact: true }).click()
  await coordinator.getByRole('dialog').getByRole('combobox').click()
  await coordinator.getByRole('option', { name: 'Medium' }).click()
  await coordinator.getByRole('dialog').getByRole('button', { name: 'Verify incident' }).click()
  await expect(header.getByText('Verified', { exact: true })).toBeVisible()
  await coordinator.getByRole('button', { name: 'Assign responder' }).click()
  const assign = coordinator.getByRole('dialog')
  await assign.getByRole('radio', { name: /MED-01/ }).check()
  const override = assign.getByLabel(/override reason/i)
  if (await override.isVisible()) await override.fill('E2E: reusing the demo responder.')
  await assign.getByRole('button', { name: 'Assign' }).click()
  await expect(header.getByText('Assigned', { exact: true })).toBeVisible()

  // The responder is told, and the notice leads to My assignments.
  const responder = await browser.newPage()
  await signIn(responder, 'responder@phantom.demo')
  await responder.getByRole('button', { name: /^Notifications, \d+ unread$/ }).click()
  await responder.getByRole('menuitem', { name: new RegExp(`New assignment: ${reference}`) }).click()
  await expect(responder).toHaveURL(/\/assignments$/)

  const card = responder.getByRole('article', { name: `Assignment MED-01 to ${reference}` })
  await card.getByRole('button', { name: 'Decline' }).click()
  await responder.getByRole('dialog').getByLabel('Reason').fill('E2E: off shift.')
  await responder.getByRole('dialog').getByRole('button', { name: 'Decline assignment' }).click()
  await expect(card.getByText('Declined', { exact: true })).toBeVisible()

  // Coordinators are told about the decline; the notice leads back to the incident.
  await coordinator.goto('/notifications')
  const item = coordinator.getByRole('button', { name: new RegExp(`^MED-01 declined ${reference}`) })
  await expect(item).toBeVisible()
  await expect(item).toContainText('E2E: off shift.')
  await item.click()
  await expect(coordinator.getByRole('heading', { name: title })).toBeVisible()
  await expect(header.getByText('Verified', { exact: true })).toBeVisible()

  await responder.close()
  await coordinator.close()
})
