import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'
import { card, openSheet } from './output.ts'

const { steps, output } = strings

test.use({ viewport: { width: 390, height: 844 } })

async function noHorizontalScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('los tres pasos a 390 px no tienen scroll horizontal; la hoja de salida tampoco y Escape devuelve el foco a «Está bien»', async ({ page }) => {
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

  const sheet = await openSheet(page)
  await noHorizontalScroll(page)
  expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  // Mandar starts open without Web Share: its fields fit too.
  await expect(sheet.getByLabel(output.whatsapp.label)).toBeVisible()
  expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await expect(card(page, output.options.print.title)).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: steps.print.primary, exact: true })).toBeFocused()
})

test('la hoja de salida atrapa el foco; tocar afuera o deslizar el asa hacia abajo la cierran', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  const ok = page.getByRole('button', { name: steps.print.primary, exact: true })

  let sheet = await openSheet(page)
  const first = card(page, output.options.print.title)
  await expect(first).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(first).not.toBeFocused()
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()

  await page.mouse.click(195, 20)
  await expect(sheet).toBeHidden()
  await expect(ok).toBeFocused()

  sheet = await openSheet(page)
  const handle = (await page.getByTestId('output-sheet-handle').boundingBox())!
  const x = handle.x + handle.width / 2
  const y = handle.y + handle.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 60, { steps: 4 })
  await page.mouse.move(x, y + 140, { steps: 4 })
  await page.mouse.up()
  await expect(sheet).toBeHidden()
  await expect(ok).toBeFocused()

  // A short drag does not close it.
  sheet = await openSheet(page)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 20, { steps: 2 })
  await page.mouse.up()
  await expect(sheet).toBeVisible()
})
