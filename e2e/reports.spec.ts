import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function total(page: Page): Promise<number> {
  const figure = page.getByRole('region', { name: 'Headline figures' }).locator('div').filter({ hasText: /^Incidents reported/ }).first()
  return Number(((await figure.locator('p.text-2xl').textContent()) ?? '').replace(/\D/g, ''))
}

test('a coordinator reviews the period’s figures and exports them as CSV', async ({ page }) => {
  await signIn(page, 'coordinator@phantom.demo')
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'By category' })).toBeVisible()
  const before = await total(page)

  // A new public report counts towards today.
  const reporter = await page.context().newPage()
  await reporter.goto('/report')
  await reporter.getByLabel(/title/i).fill(`E2E reports ${Date.now()}`)
  await reporter.getByLabel(/description/i).fill('Flooded underpass, cars stalled in the water.')
  await reporter.getByLabel(/^location/i).fill('Ojuelegba underpass')
  await reporter.getByRole('combobox', { name: /category/i }).selectOption('Flood')
  await reporter.getByRole('button', { name: /submit report/i }).click()
  await expect(reporter.locator('p.font-mono').first()).toHaveText(/^PH-\d{4}-\d{6}$/)
  await reporter.close()

  await page.reload()
  await expect.poll(() => total(page)).toBe(before + 1)

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /download csv/i }).click()])
  expect(download.suggestedFilename()).toMatch(/^phantom-summary-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/)
  const csv = (await readFile((await download.path())!, 'utf8')).replace(/^﻿/, '')
  const lines = csv.split('\r\n')
  expect(lines[0]).toBe('section,item,value,sample_size')
  expect(lines).toContain(`incidents,total,${before + 1},`)
  expect(lines.some((l) => l.startsWith('category,Flood,'))).toBe(true)
  expect(lines.some((l) => l.startsWith('ai_severity_agreement,rate,'))).toBe(true)
})
