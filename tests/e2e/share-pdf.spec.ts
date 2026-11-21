import { statSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { steps, doneStep } = strings

type ShareMode = 'resolve' | 'abort' | 'fail' | 'no-files'

/** Fake Web Share API: records each shared file's name, type and size on `window.__shared`. */
async function fakeShare(page: Page, mode: ShareMode) {
  await page.addInitScript((m: ShareMode) => {
    const w = window as unknown as { __shared: { name: string; type: string; size: number }[] }
    w.__shared = []
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: { files?: File[] }) => m !== 'no-files' && !!data.files?.length,
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data: { files: File[] }) => {
        for (const f of data.files) w.__shared.push({ name: f.name, type: f.type, size: f.size })
        if (m === 'abort') return Promise.reject(new DOMException('cancelled', 'AbortError'))
        if (m === 'fail') return Promise.reject(new DOMException('denied', 'NotAllowedError'))
        return Promise.resolve()
      },
    })
  }, mode)
}

async function toPrint(page: Page) {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
}

async function downloadPdf(page: Page): Promise<number> {
  await toPrint(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: steps.print.primary, exact: true }).click(),
  ])
  await expect(page.getByRole('heading', { level: 1, name: steps.done.title })).toBeVisible()
  return statSync((await download.path())!).size
}

const shared = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shared: { name: string; type: string; size: number }[] }).__shared)

test('Compartir PDF comparte el PDF descargado desde la memoria', async ({ page }) => {
  await fakeShare(page, 'resolve')
  const size = await downloadPdf(page)
  await page.getByRole('button', { name: doneStep.share }).click()
  await expect.poll(() => shared(page)).toEqual([{ name: 'dni-print-2-copias.pdf', type: 'application/pdf', size }])
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('cancelar el menú de compartir no muestra error', async ({ page }) => {
  await fakeShare(page, 'abort')
  await downloadPdf(page)
  await page.getByRole('button', { name: doneStep.share }).click()
  await expect.poll(async () => (await shared(page)).length).toBe(1)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('si compartir falla aparece el aviso', async ({ page }) => {
  await fakeShare(page, 'fail')
  await downloadPdf(page)
  await page.getByRole('button', { name: doneStep.share }).click()
  await expect(page.getByRole('alert')).toHaveText(doneStep.shareFailed)
})

test('sin soporte para compartir archivos no hay botón', async ({ page }) => {
  await fakeShare(page, 'no-files')
  await downloadPdf(page)
  await expect(page.getByText(doneStep.instruction)).toBeVisible()
  await expect(page.getByRole('button', { name: doneStep.share })).toHaveCount(0)
})

test('con 1 copia comparte dni-print-1-copias.pdf', async ({ page }) => {
  await fakeShare(page, 'resolve')
  await toPrint(page)
  await page.getByRole('button', { name: strings.printStep.copies[1] }).click()
  await expect(page.getByRole('button', { name: strings.printStep.copies[1] })).toHaveAttribute('aria-pressed', 'true')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: steps.print.primary, exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toBe('dni-print-1-copias.pdf')
  const size = statSync((await download.path())!).size
  await expect(page.getByRole('heading', { level: 1, name: steps.done.title })).toBeVisible()
  await page.getByRole('button', { name: doneStep.share }).click()
  await expect.poll(() => shared(page)).toEqual([{ name: 'dni-print-1-copias.pdf', type: 'application/pdf', size }])
})
