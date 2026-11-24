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

async function total(page: Page): Promise<number> {
  const tile = page.getByRole('region', { name: 'Key figures' }).getByRole('listitem').filter({ hasText: 'Total incidents' })
  return Number(((await tile.locator('p.text-2xl').textContent()) ?? '').replace(/\D/g, ''))
}

async function submit(page: Page, title: string): Promise<string> {
  await page.goto('/report')
  await page.getByLabel(/title/i).fill(title)
  await page.getByLabel(/description/i).fill('Live update check: smoke from a roadside generator.')
  await page.getByLabel(/^location/i).fill('Bode Thomas Street, Surulere')
  await page.getByRole('combobox', { name: /category/i }).selectOption('Fire')
  await page.getByRole('button', { name: /submit report/i }).click()
  return ((await page.locator('p.font-mono').first().textContent()) ?? '').trim()
}

test('the dashboard and a responder’s assignments update live, without reloading', async ({ page, browser }) => {
  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await expect(coordinator).toHaveURL(/\/dashboard$/)
  await expect(coordinator.getByRole('status', { name: 'Live updates on' })).toBeVisible()
  await expect(coordinator.getByRole('region', { name: 'Key figures' }).locator('p.text-2xl').first()).toBeVisible()
  const before = await total(coordinator)

  const title = `E2E live ${Date.now()}`
  const reference = await submit(page, title)

  // No reload and no polling while live: only a pushed event can bring these in this quickly.
  await expect.poll(() => total(coordinator), { timeout: 10_000 }).toBeGreaterThan(before)
  await expect(coordinator.getByRole('list', { name: 'Recent activity' }).getByRole('link', { name: reference }).first()).toBeVisible({ timeout: 10_000 })

  // A responder watching My assignments sees a new assignment arrive.
  const responder = await browser.newPage()
  await signIn(responder, 'responder@phantom.demo')
  await expect(responder).toHaveURL(/\/assignments$/)
  await expect(responder.getByRole('status', { name: 'Live updates on' })).toBeVisible()

  await coordinator.goto('/incidents')
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

  const card = responder.getByRole('article', { name: `Assignment MED-01 to ${reference}` })
  await expect(card).toBeVisible({ timeout: 10_000 })
  await expect(responder.getByRole('button', { name: /^Notifications, \d+\+? unread$/ })).toBeVisible()

  // The responder declines; the coordinator's open incident page reflects it without a reload.
  await card.getByRole('button', { name: 'Decline' }).click()
  await responder.getByRole('dialog').getByLabel('Reason').fill('E2E: off shift.')
  await responder.getByRole('dialog').getByRole('button', { name: 'Decline assignment' }).click()
  await expect(header.getByText('Verified', { exact: true })).toBeVisible({ timeout: 10_000 })

  await responder.close()
  await coordinator.close()
})

test('when live updates cannot connect, the screen says so and still works', async ({ page }) => {
  await page.route('**/hubs/**', (route) => route.abort())
  await signIn(page, 'coordinator@phantom.demo')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('Live updates paused')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Key figures' }).locator('p.text-2xl').first()).toBeVisible()
})
