import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'

const { cropStep, steps } = strings
const card = () => ({ name: 'card.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/synthetic-card.png') })

test('detección automática: Se ve bien en ambas caras y descarga sin tocar esquinas', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(card())
  await page.getByTestId('back-gallery').setInputFiles(card())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  const ok = page.getByRole('button', { name: steps.crop.primary, exact: true })
  await expect(page.getByRole('button', { name: cropStep.adjust })).toBeVisible()
  await expect(page.getByText(cropStep.notFound)).toHaveCount(0)
  await ok.click()
  await expect(page.getByRole('button', { name: cropStep.adjust })).toBeVisible()
  await ok.click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: steps.print.primary, exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
})

test('Ajustar esquinas abre el editor y Restablecer vuelve al quad detectado', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(card())
  await page.getByTestId('back-gallery').setInputFiles(card())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await page.getByRole('button', { name: cropStep.adjust }).click()
  await expect(page.getByTestId('corner-editor')).toBeVisible()
  const tl = page.getByRole('button', { name: cropStep.corners[0] })
  const left = () => tl.evaluate((el) => parseFloat(el.getAttribute('style')!.match(/left:\s*([\d.]+)/)![1]))
  const detected = await left()
  await tl.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(left).toBeGreaterThan(detected)
  await page.getByRole('button', { name: cropStep.reset }).click()
  await expect.poll(left).toBeCloseTo(detected, 1)
})
