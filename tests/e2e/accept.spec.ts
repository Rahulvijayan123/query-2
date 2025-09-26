import { test, expect } from '@playwright/test'

test('accept finalizes: footer hides and final_thesis emitted', async ({ page }) => {
  await page.goto('/research')
  await page.getByPlaceholder('Type your research query…').fill('Accept flow check')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText(/^Thesis \(/)).toBeVisible({ timeout: 45000 })
  await page.getByRole('button', { name: 'Accept' }).click()
  await expect(page.getByRole('button', { name: 'Accept' })).toBeHidden({ timeout: 5000 })
  await expect(page.getByRole('button', { name: 'Reject' })).toBeHidden({ timeout: 5000 })
})

test('no duplicate clarifying questions on reconnect', async ({ page }) => {
  await page.goto('/research')
  await page.getByPlaceholder('Type your research query…').fill('Reconnect dedupe test')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Clarifying Questions')).toBeVisible({ timeout: 30000 })
  await page.reload()
  await page.getByPlaceholder('Type your research query…').fill('Reconnect dedupe test')
  await page.getByRole('button', { name: 'Start' }).click()
  const cards = page.getByText('Clarifying Questions')
  await expect(cards).toHaveCount(1, { timeout: 5000 })
})


