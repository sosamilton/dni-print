import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { savePdf } from './output.ts'
import { pngFile } from './fixtures.ts'

const { steps } = strings

test('con el service worker activo, cargar, esquinas y PDF funcionan sin conexión', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'setOffline con service workers es confiable en chromium')
  await page.goto('./')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: steps.load.title })).toBeVisible()
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.print.title })).toBeVisible()
  const download = await savePdf(page)
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
})
