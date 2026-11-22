import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'
import { card } from './output.ts'

const { steps, output } = strings

test.use({ viewport: { width: 1280, height: 800 } })

async function layoutOk(page: Page) {
  const m = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth - window.innerWidth,
    width: document.querySelector('.wizard')!.getBoundingClientRect().width,
  }))
  expect(m.over).toBeLessThanOrEqual(0)
  expect(m.width).toBeLessThanOrEqual(1120)
}

const disjoint = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x >= b.x + b.width || b.x >= a.x + a.width || a.y >= b.y + b.height || b.y >= a.y + a.height

test('los tres pasos a 1280 px: sin scroll horizontal y, en el paso 3, el panel de salida a la derecha sin «Está bien»', async ({ page }) => {
  await page.goto('./')
  await layoutOk(page)
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  const slots = await page.locator('.face-slot').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))
  expect(slots).toHaveLength(2)
  expect(Math.abs(slots[0].y - slots[1].y)).toBeLessThanOrEqual(1)
  expect(slots[1].x).toBeGreaterThanOrEqual(slots[0].x + slots[0].width - 1)
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await layoutOk(page)
  const editor = await page.getByTestId('corner-editor').boundingBox()
  const result = await page.locator('.crop-result').boundingBox()
  expect(result!.x).toBeGreaterThanOrEqual(editor!.x + editor!.width - 1)
  await layoutOk(page)
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.print.title })).toBeVisible()
  await layoutOk(page)

  await expect(page.getByRole('button', { name: steps.print.primary, exact: true })).toHaveCount(0)
  await expect(page.locator('.wizard-footer')).toHaveCount(0)
  const panel = (await page.getByRole('region', { name: output.title }).boundingBox())!
  const preview = (await page.locator('.sheet-preview').boundingBox())!
  const options = (await page.locator('.print-options').boundingBox())!
  expect(panel.x).toBeGreaterThanOrEqual(preview.x + preview.width - 1)
  expect(panel.x).toBeGreaterThanOrEqual(options.x + options.width - 1)
  expect(disjoint(panel, preview)).toBe(true)
  // The whole sheet and the first options fit on screen without scrolling.
  expect(preview.y + preview.height).toBeLessThanOrEqual(800)
  const print = card(page, output.options.print.title)
  await expect(print).toHaveAttribute('data-highlighted', 'true')
  await expect(print).toBeInViewport()
})
