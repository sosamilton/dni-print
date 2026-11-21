import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { steps, cropStep, printStep, doneStep, loadStep, wizard } = strings

async function loadFaces(page: Page) {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
}

const primary = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true })

test('flujo completo solo con teclado, esquinas incluidas, con foco y anuncio por paso', async ({ page }) => {
  await loadFaces(page)
  await expect(page.getByRole('button', { name: loadStep.faceAreaLabel('Frente', loadStep.faceStates.loaded) })).toBeVisible()

  await primary(page, steps.load.primary).focus()
  await page.keyboard.press('Enter')
  const title = page.getByRole('heading', { level: 1, name: steps.crop.title })
  await expect(title).toBeFocused()
  await expect(page.getByRole('status').filter({ hasText: wizard.stepAnnouncement(2, 3, steps.crop.title) })).toHaveCount(1)

  // Editor de esquinas con teclado: mover una esquina y confirmar ambas caras.
  const tl = page.getByRole('button', { name: cropStep.corners[0] })
  await tl.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: cropStep.corners[1] })).toBeFocused()
  await primary(page, steps.crop.primary).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(cropStep.faceCounter('Dorso', 2, 2))).toBeVisible()
  await primary(page, steps.crop.primary).focus()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { level: 1, name: steps.print.title })).toBeFocused()
  await page.getByRole('button', { name: printStep.copies[1] }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: printStep.copies[1] })).toHaveAttribute('aria-pressed', 'true')

  await primary(page, steps.print.primary).focus()
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')])
  expect(readFileSync((await download.path())!).toString('latin1')).toContain('%PDF')
  await expect(page.getByRole('heading', { level: 1, name: steps.done.title })).toBeFocused()
  await expect(page.getByRole('heading', { name: doneStep.iosGuideTitle })).toHaveCount(0)
})

test('a 320 px no hay scroll horizontal en ningún paso', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await loadFaces(page)
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
  expect(await noOverflow()).toBe(true)
  await primary(page, steps.load.primary).click()
  expect(await noOverflow()).toBe(true)
  await primary(page, steps.crop.primary).click()
  await primary(page, steps.crop.primary).click()
  expect(await noOverflow()).toBe(true)
})

test('desde 900 px el paso 3 va en dos columnas; antes, en una', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await loadFaces(page)
  await primary(page, steps.load.primary).click()
  await primary(page, steps.crop.primary).click()
  await primary(page, steps.crop.primary).click()
  const preview = (await page.locator('.print-preview').boundingBox())!
  const options = (await page.locator('.print-options').boundingBox())!
  expect(preview.x).toBeLessThan(options.x)
  await page.setViewportSize({ width: 600, height: 800 })
  const narrow = (await page.locator('.print-options').boundingBox())!
  const narrowPreview = (await page.locator('.print-preview').boundingBox())!
  expect(narrowPreview.y).toBeGreaterThan(narrow.y)
})

test('escritorio dice "tu dispositivo" y no muestra la guía de iOS', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText(loadStep.privacyNotice(true))).toBeVisible()
})

test.describe('iOS', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })

  test('Listo incluye la guía y el aviso dice "teléfono"', async ({ page }) => {
    await loadFaces(page)
    await expect(page.getByText(loadStep.privacyNotice(false))).toBeVisible()
    await primary(page, steps.load.primary).click()
    await primary(page, steps.crop.primary).click()
    await primary(page, steps.crop.primary).click()
    await Promise.all([page.waitForEvent('download'), primary(page, steps.print.primary).click()])
    await expect(page.getByRole('heading', { name: doneStep.iosGuideTitle })).toBeVisible()
  })
})
