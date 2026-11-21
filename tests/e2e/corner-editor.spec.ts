import { expect, test, type Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { cropStep, steps } = strings

async function openCrop(page: Page) {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
}

const ok = (page: Page) => page.getByRole('button', { name: steps.crop.primary, exact: true })

test('una cara por vez: frente, dorso y luego paso 3', async ({ page }) => {
  await openCrop(page)
  await expect(page.getByText(cropStep.faceCounter('Frente', 1, 2))).toBeVisible()
  await expect(page.getByText(cropStep.notFound)).toBeVisible()
  await ok(page).click()
  await expect(page.getByText(cropStep.faceCounter('Dorso', 2, 2))).toBeVisible()
  await ok(page).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.print.title })).toBeVisible()
})

test('teclado: Tab, flechas y Shift+flechas mueven la esquina', async ({ page }) => {
  await openCrop(page)
  const tl = page.getByRole('button', { name: cropStep.corners[0] })
  await tl.focus()
  const x0 = await tl.evaluate((el) => parseFloat(el.getAttribute('style')!.match(/left:\s*([\d.]+)/)![1]))
  await page.keyboard.press('Shift+ArrowRight')
  const x1 = await tl.evaluate((el) => parseFloat(el.getAttribute('style')!.match(/left:\s*([\d.]+)/)![1]))
  expect(x1).toBeGreaterThan(x0)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: cropStep.corners[1] })).toBeFocused()
})

test('cruzar esquinas muestra el error y bloquea; Restablecer lo arregla; poca resolución avisa', async ({ page }) => {
  await openCrop(page)
  // El PNG sintético mide 120 px de ancho: el aviso ámbar aparece.
  await expect(page.getByText(cropStep.lowResolution)).toBeVisible()
  const tl = page.getByRole('button', { name: cropStep.corners[0] })
  await tl.focus()
  // TL pasa más allá de TR en x (96 px de margen de 12 → 10 flechas grandes).
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowRight')
  await expect(page.getByText(cropStep.invalid)).toBeVisible()
  await expect(ok(page)).toBeDisabled()
  await page.getByRole('button', { name: cropStep.reset }).click()
  await expect(page.getByText(cropStep.invalid)).toHaveCount(0)
  await expect(ok(page)).toBeEnabled()
})

test('arrastrar una esquina con el mouse y girar', async ({ page }) => {
  await openCrop(page)
  const br = page.getByTestId('corner-2')
  const box = (await br.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 5, box.y + box.height / 2 - 5)
  await expect(page.getByRole('img', { name: cropStep.magnifierLabel })).toBeVisible()
  await page.mouse.up()
  await expect(page.getByRole('img', { name: cropStep.magnifierLabel })).toHaveCount(0)
  await page.getByRole('button', { name: cropStep.rotate }).click()
  await expect(page.getByRole('img', { name: cropStep.resultLabel })).toBeVisible()
})
