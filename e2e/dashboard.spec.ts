import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function figure(page: Page, label: string): Promise<number> {
  const tile = page.getByRole('region', { name: 'Key figures' }).getByRole('listitem').filter({ hasText: label })
  await expect(tile.locator('p.text-2xl')).toBeVisible()
  return Number(((await tile.locator('p.text-2xl').textContent()) ?? '').replace(/\D/g, ''))
}

test('the dashboard counts live records, shows recent activity and maps open incidents', async ({ page, browser }) => {
  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await expect(coordinator).toHaveURL(/\/dashboard$/)
  await expect(coordinator.getByRole('heading', { name: 'Command dashboard' })).toBeVisible()
  const awaitingBefore = await figure(coordinator, 'Awaiting review')
  const totalBefore = await figure(coordinator, 'Total incidents')

  const title = `E2E dashboard ${Date.now()}`
  await page.goto('/report')
  await page.getByLabel(/title/i).fill(title)
  await page.getByLabel(/description/i).fill('Collapsed wall blocking the pavement.')
  await page.getByLabel(/^location/i).fill('Broad Street, Lagos Island')
  await page.getByRole('combobox', { name: /category/i }).selectOption('Infrastructure')
  await page.getByRole('button', { name: /submit report/i }).click()
  const reference = ((await page.locator('p.font-mono').first().textContent()) ?? '').trim()

  await coordinator.reload()
  await expect.poll(() => figure(coordinator, 'Total incidents')).toBe(totalBefore + 1)
  expect(await figure(coordinator, 'Awaiting review')).toBe(awaitingBefore + 1)

  const activity = coordinator.getByRole('list', { name: 'Recent activity' })
  const received = activity.getByRole('listitem').filter({ hasText: `Public report ${reference} received` })
  await expect(received).toBeVisible()
  await expect(received).toContainText('Member of the public')
  await expect(coordinator.locator('canvas.mapboxgl-canvas')).toBeVisible()

  await received.getByRole('link', { name: reference }).click()
  await expect(coordinator.getByRole('heading', { name: title })).toBeVisible()
  await coordinator.close()
})
