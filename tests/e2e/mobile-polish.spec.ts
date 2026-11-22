import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { steps } = strings

test.use({ viewport: { width: 390, height: 844 } })

async function noHorizontalScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('los cuatro pasos a 390 px no tienen scroll horizontal y el final dice «Empezar de nuevo»', async ({ page }) => {
  await page.goto('./')
  await noHorizontalScroll(page)
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await noHorizontalScroll(page)
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await noHorizontalScroll(page)
  // The sheet notice must stay reachable above the fixed footer.
  const notice = page.getByText(strings.printStep.notice)
  await notice.scrollIntoViewIfNeeded()
  const noticeBox = await notice.boundingBox()
  const footerBox = await page.locator('.wizard-footer').boundingBox()
  expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(footerBox!.y + 1)
  await page.getByRole('button', { name: steps.print.primary, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.done.title })).toBeVisible()
  await noHorizontalScroll(page)
  expect(steps.done.primary).toBe('Empezar de nuevo')
  await expect(page.getByText(steps.done.note)).toBeVisible()
  await expect(page.getByRole('button', { name: steps.done.primary, exact: true })).toBeVisible()
})
