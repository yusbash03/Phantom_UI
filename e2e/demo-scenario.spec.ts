import { expect, test, type Page } from '@playwright/test'

/**
 * P0 checkpoint (task 28): the demonstration scenario of design.md §12, end to end against the real API and
 * PostgreSQL. The AI provider is the labelled recorded fixture (Ai__Provider=RecordedFixture, set in
 * playwright.config.ts), so no live model is called and the AI output is deterministic.
 */
const password = process.env.PHANTOM_DEMO_PASSWORD
test.skip(!password, 'Set PHANTOM_DEMO_PASSWORD to the seeded demo password')
test.setTimeout(240_000)

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('demonstration scenario: report → AI → map → duplicate → verify → assign → respond → resolve → audit', async ({ page, browser }) => {
  const tag = `demo${Date.now().toString(36)}`
  // A spot of its own, so earlier runs' incidents are neither under the marker nor suggested as duplicates.
  const latitude = 7.37 + Math.random() * 0.03
  const longitude = 3.9 + Math.random() * 0.03

  async function publicReport(title: string, description: string, lat: number): Promise<string> {
    await page.goto('/report')
    await page.getByLabel(/title/i).fill(title)
    await page.getByLabel(/description/i).fill(description)
    await page.getByLabel(/^location/i).fill(`Ring Road transformer by the ${tag} junction`)
    await page.getByRole('combobox', { name: /category/i }).selectOption('Fire')
    await page.getByText('Add precise coordinates (optional)').click()
    await page.getByLabel('Latitude').fill(lat.toFixed(5))
    await page.getByLabel('Longitude').fill(longitude.toFixed(5))
    await page.getByRole('button', { name: /submit report/i }).click()
    const reference = ((await page.locator('p.font-mono').first().textContent()) ?? '').trim()
    // Stored, reference returned (Requirement 4.2).
    expect(reference).toMatch(/^PH-\d{4}-\d{6}$/)
    return reference
  }

  // 1. A member of the public reports a fire.
  const title = `Transformer fire ${tag}`
  const first = await publicReport(title, `Sparks and smoke from the pole transformer on the corner of the ${tag} junction.`, latitude)

  // 2. The coordinator opens it from the dashboard's recent activity.
  const coordinator = await browser.newPage()
  await signIn(coordinator, 'coordinator@phantom.demo')
  await expect(coordinator).toHaveURL(/\/dashboard$/)
  await coordinator.getByRole('list', { name: 'Recent activity' }).getByRole('link', { name: first }).first().click()
  await expect(coordinator.getByRole('heading', { name: title })).toBeVisible()
  const incidentUrl = coordinator.url()
  const header = coordinator.getByRole('main').locator('header')

  // 3. AI extraction and severity: advisory, labelled, never applied.
  const ai = coordinator.locator('[aria-labelledby="ai-panel-title"]')
  await expect(ai.getByText('Advisory only')).toBeVisible()
  const comparison = ai.getByRole('table', { name: /compared with approved values/i })
  await expect(comparison).toBeVisible({ timeout: 45_000 })
  await expect(ai.getByText('Recorded test fixture — not an analysis of this report')).toBeVisible()
  await expect(comparison.getByLabel('AI recommends Medium')).toBeVisible()
  await expect(comparison.getByText('Not yet assessed')).toBeVisible()
  await expect(ai.getByText('electrical fire risk')).toBeVisible()
  await expect(header.getByText('Reported', { exact: true })).toBeVisible()

  // 4. Mapped, with an honest location label.
  await coordinator.goto('/map')
  const marker = coordinator.getByRole('button', { name: new RegExp(`^${first}, Fire, .*unverified location \\(reporter-supplied, unverified\\)`) })
  await expect(marker).toBeVisible()
  await marker.focus()
  await marker.press('Enter')
  await expect(coordinator.locator('[aria-labelledby="selected-incident-title"]').getByRole('heading', { name: title })).toBeVisible()

  // 5. A second person reports the same fire a few metres away.
  const second = await publicReport(
    `Fire at transformer ${tag}`,
    `Transformer on the ${tag} junction sparking and smoking, people moving away.`,
    latitude + 0.0006,
  )

  // 6. PHANTOM suggests a possible duplicate; the coordinator confirms it, keeping the first as primary.
  await coordinator.goto('/incidents')
  await coordinator.getByLabel('Search incidents').fill(second)
  const row = coordinator.getByRole('row').filter({ has: coordinator.getByRole('link', { name: second }) })
  await expect(row.getByText('Possible duplicate', { exact: true })).toBeVisible()
  await row.getByRole('link', { name: second }).click()
  const relations = coordinator.locator('[aria-labelledby="relations-title"]')
  // Earlier runs may sit nearby too; this is the suggestion pairing it with the first report.
  const suggestion = relations.getByRole('listitem').filter({ has: coordinator.getByRole('link', { name: first }) })
  await expect(suggestion.getByText(/possible duplicate · \d+% match/i)).toBeVisible()
  await suggestion.getByRole('button', { name: /confirm duplicate/i }).click()
  const merge = coordinator.getByRole('dialog')
  await expect(merge.getByRole('radio', { name: new RegExp(first) })).toBeChecked()
  await merge.getByRole('button', { name: `Close ${second} as duplicate` }).click()
  await expect(header.getByText('Closed', { exact: true })).toBeVisible()

  // 7. Review and verify: the coordinator sets severity High, overriding the AI's Medium.
  await coordinator.goto(incidentUrl)
  await expect(coordinator.getByRole('heading', { name: 'Public reports (2)' })).toBeVisible()
  await coordinator.getByRole('button', { name: 'Start review' }).click()
  await expect(header.getByText('Under review', { exact: true })).toBeVisible()
  await coordinator.getByRole('button', { name: 'Verify', exact: true }).click()
  const verify = coordinator.getByRole('dialog')
  await verify.getByRole('combobox').click()
  await coordinator.getByRole('option', { name: 'High' }).click()
  await verify.getByRole('button', { name: 'Verify incident' }).click()
  await expect(header.getByText('Verified', { exact: true })).toBeVisible()
  await expect(header.getByLabel('High severity')).toBeVisible()

  // 8. Assign a responder.
  await coordinator.getByRole('button', { name: 'Assign responder' }).click()
  const assign = coordinator.getByRole('dialog')
  await assign.getByRole('radio', { name: /MED-01/ }).check()
  const override = assign.getByLabel(/override reason/i)
  if (await override.isVisible()) await override.fill('Demo: reusing the demo responder.')
  await assign.getByRole('button', { name: 'Assign' }).click()
  await expect(header.getByText('Assigned', { exact: true })).toBeVisible()

  // 9. The responder acknowledges and reports progress.
  const responder = await browser.newPage()
  await signIn(responder, 'responder@phantom.demo')
  await expect(responder).toHaveURL(/\/assignments$/)
  const card = responder.getByRole('article', { name: `Assignment MED-01 to ${first}` })
  await card.getByRole('button', { name: 'Acknowledge' }).click()
  await card.getByRole('button', { name: 'On my way' }).click()
  await expect(card.getByText('En route', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Post update' }).click()
  await responder.getByRole('dialog').getByLabel('Update').fill('Utility crew called; cordon set up around the pole.')
  await responder.getByRole('dialog').getByRole('button', { name: 'Post update' }).click()
  await expect(card.getByText('Utility crew called; cordon set up around the pole.')).toBeVisible()
  await card.getByRole('button', { name: 'Arrived on scene' }).click()
  await card.getByRole('button', { name: 'Complete' }).click()
  await responder.getByRole('dialog').getByLabel('Resolution notes').fill('Power isolated by the utility, transformer fire out.')
  await responder.getByRole('dialog').getByRole('button', { name: 'Complete assignment' }).click()
  await expect(card.getByText('Completed', { exact: true })).toBeVisible()
  await responder.close()

  // 10. The coordinator resolves the incident.
  await coordinator.reload()
  await expect(header.getByText('In progress', { exact: true })).toBeVisible()
  await coordinator.getByRole('button', { name: 'Resolve' }).click()
  const resolve = coordinator.getByRole('dialog')
  await resolve.getByLabel('Resolution details').fill('Power isolated and fire extinguished; no injuries.')
  await resolve.getByRole('button', { name: 'Resolve incident' }).click()
  await expect(header.getByText('Resolved', { exact: true })).toBeVisible()

  // 11. Audit trail: the history tells the whole story in order, AI marked as AI.
  const history = coordinator.getByRole('list', { name: 'Incident history' })
  const expectedInOrder = [
    `Public report ${first} received`,
    'AI recommended Medium severity',
    `Report ${second} moved after a confirmed duplicate`,
    'Status changed from Reported to Under review',
    'Status changed from Under review to Verified',
    'MED-01 assigned',
    'MED-01: Assigned → Acknowledged',
    'MED-01: On scene → Completed',
    'Status changed from In progress to Resolved',
  ]
  await expect(history.getByText(expectedInOrder.at(-1)!)).toBeVisible()
  const titles = await history.getByRole('listitem').locator('.font-medium').allTextContents()
  let position = -1
  for (const expected of expectedInOrder) {
    const next = titles.findIndex((t, i) => i > position && t.includes(expected))
    expect(next, `“${expected}” should follow position ${position} in: ${titles.join(' | ')}`).toBeGreaterThan(position)
    position = next
  }
  const aiEntry = history.getByRole('listitem').filter({ hasText: 'AI recommended Medium severity' })
  await expect(aiEntry.getByText('AI', { exact: true })).toBeVisible()
  await expect(aiEntry).toContainText('Recorded test fixture replayed')
  await expect(history.getByRole('listitem').filter({ hasText: 'to Verified' })).toContainText('Approved severity: High')
  await coordinator.close()

  // An administrator finds the verification in the audit log.
  await signIn(page, 'admin@phantom.demo')
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto('/admin/audit')
  await page.getByLabel('Entity ID').fill(incidentUrl.split('/').at(-1)!)
  await page.getByRole('combobox', { name: /filter by action/i }).click()
  await page.getByRole('option', { name: 'incident.status_changed' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'incident.status_changed' }).first()).toBeVisible()
})
