import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')
// Chromium's fake microphone: a real WebM/Opus recording without a sound card or a permission prompt.
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['microphone'],
})
test.setTimeout(120_000)

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('a reporter records a voice note in the browser and a coordinator can play the original', async ({ page, browser }) => {
  const title = `E2E voice ${Date.now()}`
  await page.goto('/report')
  await page.getByLabel(/title/i).fill(title)
  await page.getByLabel(/description/i).fill('Gas smell near the filling station, people moving away.')
  await page.getByLabel(/^location/i).fill('Ikorodu Road filling station')
  await page.getByRole('combobox', { name: /category/i }).selectOption('Other')

  await page.getByRole('button', { name: 'Record a voice note' }).click()
  await expect(page.getByRole('timer', { name: 'Recording time' })).toContainText('Recording 0:0')
  await page.waitForTimeout(2_000)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByLabel('Your voice note')).toBeVisible()

  await page.getByRole('button', { name: /submit report/i }).click()
  const reference = ((await page.locator('p.font-mono').first().textContent()) ?? '').trim()
  expect(reference).toMatch(/^PH-\d{4}-\d{6}$/)

  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await expect(coordinator).toHaveURL(/\/dashboard$/)
  await coordinator.goto('/incidents')
  await coordinator.getByLabel('Search incidents').fill(reference)
  await coordinator.getByRole('link', { name: reference }).click()
  await expect(coordinator.getByRole('heading', { name: title })).toBeVisible()

  const attachments = coordinator.getByRole('list', { name: 'Attachments' })
  await expect(attachments.getByText('Voice recording')).toBeVisible()
  // The e2e stack replays a recorded AI fixture and has no live speech-to-text, so the recording stays untranscribed.
  await expect(attachments.getByText('Not transcribed. Listen to the original recording.')).toBeVisible()
  await attachments.getByRole('button', { name: 'Play voice recording' }).click()
  const player = attachments.getByLabel('Voice recording', { exact: true }).and(coordinator.locator('audio'))
  await expect(player).toHaveAttribute('src', /^blob:/)
  await expect.poll(() => player.evaluate((a: HTMLAudioElement) => a.readyState), { timeout: 10_000 }).toBeGreaterThan(0)
  await coordinator.close()
})
