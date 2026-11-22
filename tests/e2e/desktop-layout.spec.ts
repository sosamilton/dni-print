import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { steps } = strings

test.use({ viewport: { width: 1280, height: 800 } })

async function layoutOk(page: Page) {
  const m = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth - window.innerWidth,
    width: document.querySelector('.wizard')!.getBoundingClientRect().width,
  }))
  expect(m.over).toBeLessThanOrEqual(0)
  expect(m.width).toBeLessThanOrEqual(1120)
}

test('los cuatro pasos a 1280 px: sin scroll horizontal y «Descargar PDF» en la columna de opciones', async ({ page }) => {
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
  await layoutOk(page)
  const button = await page.getByRole('button', { name: steps.print.primary, exact: true }).boundingBox()
  const preview = await page.locator('.sheet-preview').boundingBox()
  const options = await page.locator('.print-options').boundingBox()
  expect(button!.x).toBeGreaterThanOrEqual(options!.x - 1)
  expect(button!.x + button!.width).toBeLessThanOrEqual(options!.x + options!.width + 1)
  expect(button!.y).toBeGreaterThanOrEqual(options!.y - 1)
  expect(button!.y + button!.height).toBeLessThanOrEqual(options!.y + options!.height + 1)
  const disjoint =
    button!.x >= preview!.x + preview!.width ||
    preview!.x >= button!.x + button!.width ||
    button!.y >= preview!.y + preview!.height ||
    preview!.y >= button!.y + button!.height
  expect(disjoint).toBe(true)
  await page.getByRole('button', { name: steps.print.primary, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.done.title })).toBeVisible()
  await layoutOk(page)
})
