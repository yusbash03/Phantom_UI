import { expect, test, type Page } from '@playwright/test'

const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function openNavigation(page: Page) {
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
}

test('administrator signs in, manages users, and the session survives a reload', async ({ page }) => {
  await signIn(page, 'admin@phantom.demo')
  await expect(page).toHaveURL(/\/incidents$/)
  await openNavigation(page)
  await page.getByRole('link', { name: 'Users & roles' }).click()
  await expect(page.getByRole('heading', { name: 'Users & roles' })).toBeVisible()
  await expect(page.getByText('coordinator@phantom.demo')).toBeVisible()
  await expect(page.getByText('Demo data').first()).toBeVisible()

  // Access token is memory-only; the HttpOnly refresh cookie restores the session.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Users & roles' })).toBeVisible()

  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/login$/)
})

for (const { email, role, home } of [
  { email: 'coordinator@phantom.demo', role: 'Incident Coordinator', home: /\/incidents$/ },
  { email: 'responder@phantom.demo', role: 'Responder', home: /\/assignments$/ },
]) {
  test(`${role} signs in and cannot reach user administration`, async ({ page }) => {
    await signIn(page, email)
    await expect(page).toHaveURL(home)
    await page.goto('/account')
    await expect(page.getByText(role, { exact: true }).last()).toBeVisible()

    await openNavigation(page)
    await expect(page.getByRole('link', { name: 'Users & roles' })).toHaveCount(0)

    await page.goto('/admin/users')
    await expect(page.getByText('You do not have access to this area')).toBeVisible()
  })
}

// Uses an unknown account: the server returns the identical error for unknown accounts and wrong
// passwords, and this avoids accumulating failed attempts (account throttling) on real demo users.
test('failed sign-in shows a generic error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('nobody@phantom.demo')
  await page.getByLabel('Password').fill('definitely-not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('The email or password is incorrect.')
})
