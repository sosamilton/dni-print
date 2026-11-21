import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { blurredSceneFile, sharpSceneFile } from './fixtures.ts'

const { cropStep, loadStep, photoWarnings, steps } = strings
// Detectable card without inner detail: it opens step 2 in the result view and measures as blurry.
const flatCard = () => ({ name: 'card.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/synthetic-card.png') })

test('aviso de foto borrosa en los pasos 1 y 2, sin bloquear', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(blurredSceneFile())
  await page.getByTestId('back-gallery').setInputFiles(sharpSceneFile())
  const front = page.locator('[data-face=front]')
  const back = page.locator('[data-face=back]')
  await expect(front.getByText(loadStep.loaded('Frente'))).toBeVisible()
  await expect(back.getByText(loadStep.loaded('Dorso'))).toBeVisible()

  const warning = front.getByRole('status').filter({ hasText: photoWarnings.blurry })
  await expect(warning).toBeVisible()
  await expect(page.getByText(photoWarnings.blurry)).toHaveCount(1)
  await expect(front.getByRole('button', { name: loadStep.pickFromGallery })).toBeVisible()
  const cont = page.getByRole('button', { name: steps.load.primary, exact: true })
  await expect(cont).toBeEnabled()

  // Replacing the front with a sharp photo removes the warning.
  await page.getByTestId('front-gallery').setInputFiles(sharpSceneFile('otra.png'))
  await expect(front).not.toHaveAttribute('data-status', 'processing')
  await expect(front.getByText(loadStep.loaded('Frente'))).toBeVisible()
  await expect(front.locator('canvas.face-thumb')).toBeVisible()
  await expect(page.getByText(photoWarnings.blurry)).toHaveCount(0)

  // Back to the blurry front, then on to step 2.
  await page.getByTestId('front-gallery').setInputFiles(blurredSceneFile('otra-borrosa.png'))
  await expect(warning).toBeVisible()
  await cont.click()
  await expect(page.getByRole('heading', { level: 1, name: steps.crop.title })).toBeVisible()
  // The text scene has no card to detect: step 2 opens in the corner editor.
  await expect(page.getByText(cropStep.notFound)).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: photoWarnings.blurry })).toBeVisible()
  const ok = page.getByRole('button', { name: steps.crop.primary, exact: true })
  await expect(ok).toBeEnabled()
  await ok.click()
  // The back face is sharp: no warning on its crop step.
  await expect(page.getByText(strings.cropStep.faceCounter('Dorso', 2, 2))).toBeVisible()
  await expect(page.getByText(photoWarnings.blurry)).toHaveCount(0)
})

test('aviso de foto borrosa en la vista de resultado del paso 2', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(flatCard())
  await page.getByTestId('back-gallery').setInputFiles(flatCard())
  await expect(page.locator('[data-face=back]').getByText(loadStep.loaded('Dorso'))).toBeVisible()
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await expect(page.getByRole('button', { name: cropStep.adjust })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: photoWarnings.blurry })).toBeVisible()
  await expect(page.getByRole('button', { name: steps.crop.primary, exact: true })).toBeEnabled()
})
