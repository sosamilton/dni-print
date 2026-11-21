import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile, textFile } from './fixtures.ts'

const { loadStep, steps } = strings
const cont = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: steps.load.primary, exact: true })

test('estado inicial', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByLabel(loadStep.documentLabel)).toHaveValue('dni-ar')
  await expect(page.getByText(loadStep.missing)).toHaveCount(2)
  await expect(page.getByText(loadStep.privacyNotice(true))).toBeVisible()
  await expect(cont(page)).toBeDisabled()
})

test('carga ambas caras, no imagen, cambio de documento y continuar', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await expect(page.getByText(loadStep.loaded('Frente'))).toBeVisible()
  await expect(page.getByText(loadStep.missing)).toHaveCount(1)
  await expect(cont(page)).toBeDisabled()

  await page.getByTestId('back-gallery').setInputFiles(textFile())
  await expect(page.getByText(loadStep.notImage)).toBeVisible()
  await expect(cont(page)).toBeDisabled()

  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await expect(page.getByText(loadStep.loaded('Dorso'))).toBeVisible()
  await expect(cont(page)).toBeEnabled()

  await page.getByLabel(loadStep.documentLabel).selectOption('licencia-ar')
  await expect(page.getByLabel(loadStep.documentLabel)).toHaveValue('licencia-ar')
  await expect(page.getByText(loadStep.loaded('Frente'))).toBeVisible()

  await cont(page).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.crop.title })).toBeVisible()
})

test('reemplazar una cara y conservar la foto ante un archivo no imagen', async ({ page }) => {
  await page.goto('./')
  const front = page.getByTestId('front-gallery')
  await front.setInputFiles(pngFile())
  await expect(page.getByText(loadStep.loaded('Frente'))).toBeVisible()
  const thumb = page.locator('[data-face=front] canvas.face-thumb')
  await expect(thumb).toBeVisible()
  expect(await thumb.evaluate((c) => (c as unknown as { width: number }).width)).toBeGreaterThan(0)

  await front.setInputFiles(textFile())
  await expect(page.getByText(loadStep.notImage)).toBeVisible()
  await expect(thumb).toBeVisible()

  await front.setInputFiles(pngFile('otra.png'))
  await expect(page.getByText(loadStep.loaded('Frente'))).toBeVisible()
  await expect(page.getByText(loadStep.notImage)).toHaveCount(0)
})

test('sin cámara no aparece "Sacar foto"', async ({ page }) => {
  await page.addInitScript(`navigator.mediaDevices.enumerateDevices = () => Promise.resolve([])`)
  await page.goto('./')
  await expect(page.getByText(loadStep.missing)).toHaveCount(2)
  await expect(page.getByRole('button', { name: loadStep.takePhoto })).toHaveCount(0)
})

test('con cámara aparece "Sacar foto" con captura trasera', async ({ page }) => {
  await page.addInitScript(
    `navigator.mediaDevices.enumerateDevices = () => Promise.resolve([{ kind: 'videoinput' }])`,
  )
  await page.goto('./')
  await expect(page.getByRole('button', { name: loadStep.takePhoto })).toHaveCount(2)
  await expect(page.getByTestId('front-camera')).toHaveAttribute('capture', 'environment')
})

test('arrastrar y soltar una imagen en la cara', async ({ page }) => {
  await page.goto('./')
  const file = pngFile()
  // A string keeps DOM-only APIs (DataTransfer, File) out of the Node type context.
  const dataTransfer = await page.evaluateHandle(`(() => {
    const dt = new DataTransfer()
    dt.items.add(new File([new Uint8Array(${JSON.stringify([...file.buffer])})], 'foto.png', { type: 'image/png' }))
    return dt
  })()`)
  await page.locator('[data-face=back]').dispatchEvent('drop', { dataTransfer })
  await expect(page.getByText(loadStep.loaded('Dorso'))).toBeVisible()
})
