import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { card, holdPdfBuilds, openSheet, outputSheet, setHoldPdf, toPrint } from './output.ts'

const { steps, output, printStep } = strings
const o = output.options
// Desktop Chrome's user agent at phone width: the narrow variant, with the desktop «Guardar PDF» label.

test.use({ viewport: { width: 390, height: 844 } })

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

const shared = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shared: { name: string; type: string; size: number }[] }).__shared)

function countDownloads(page: Page) {
  const seen = { count: 0 }
  page.on('download', () => seen.count++)
  return seen
}

test('Está bien abre la hoja y Compartir o mandar comparte el PDF sin descargarlo', async ({ page }) => {
  const downloads = countDownloads(page)
  await fakeShare(page, 'resolve')
  await page.goto('./')
  await toPrint(page)
  const sheet = await openSheet(page)
  const share = card(page, o.share.title)
  await expect(share).toBeFocused()
  await expect(share).toHaveAttribute('data-highlighted', 'true')
  await expect(sheet.locator('.output-card')).toHaveCount(4)
  await expect(card(page, o.save.title.pdf)).toBeVisible()
  await expect(page.getByLabel(strings.output.whatsapp.label)).toBeHidden()
  await expect(share).toBeEnabled()
  await share.click()
  await expect.poll(() => shared(page)).toEqual([{ name: 'dni-print-2-copias.pdf', type: 'application/pdf', size: expect.any(Number) }])
  expect((await shared(page))[0].size).toBeGreaterThan(1000)
  await expect(sheet.getByText(output.after.shared)).toBeFocused()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(downloads.count).toBe(0)
})

test('cancelar el menú de compartir no muestra error ni aviso', async ({ page }) => {
  await fakeShare(page, 'abort')
  await page.goto('./')
  await toPrint(page)
  await openSheet(page)
  await card(page, o.share.title).click()
  await expect.poll(async () => (await shared(page)).length).toBe(1)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText(output.after.shared)).toHaveCount(0)
  await expect(card(page, o.share.title)).toBeEnabled()
})

test('si compartir falla aparece el aviso y las opciones siguen activas', async ({ page }) => {
  await fakeShare(page, 'fail')
  await page.goto('./')
  await toPrint(page)
  await openSheet(page)
  await card(page, o.share.title).click()
  await expect(page.getByRole('alert')).toHaveText(output.shareFailed)
  await expect(card(page, o.share.title)).toBeEnabled()
  await expect(card(page, o.save.title.pdf)).toBeEnabled()
})

test('sin soporte para compartir archivos no hay Compartir, Imprimir va resaltada y Mandar arranca abierta', async ({ page }) => {
  await fakeShare(page, 'no-files')
  await page.goto('./')
  await toPrint(page)
  const sheet = await openSheet(page)
  await expect(card(page, o.share.title)).toHaveCount(0)
  await expect(sheet.locator('.output-card')).toHaveCount(3)
  await expect(card(page, o.print.title)).toHaveAttribute('data-highlighted', 'true')
  await expect(card(page, o.print.title)).toBeFocused()
  await expect(sheet.getByLabel(strings.output.whatsapp.label)).toBeVisible()
})

test('al cambiar a 1 copia las opciones se deshabilitan con «Preparando PDF…» y luego comparten dni-print-1-copias.pdf', async ({ page }) => {
  await holdPdfBuilds(page)
  await fakeShare(page, 'resolve')
  await page.goto('./')
  await toPrint(page)
  let sheet = await openSheet(page)
  await expect(card(page, o.share.title)).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  await setHoldPdf(page, true)
  await page.getByRole('button', { name: printStep.copies[1] }).click()
  sheet = await openSheet(page)
  await expect(sheet.getByText(output.preparing)).toBeVisible()
  for (const title of [o.share.title, o.print.title, o.save.title.pdf]) await expect(card(page, title)).toBeDisabled()
  await setHoldPdf(page, false)
  await expect(sheet.getByText(output.preparing)).toHaveCount(0)
  await expect(card(page, o.share.title)).toBeEnabled()
  await card(page, o.share.title).click()
  await expect.poll(() => shared(page)).toEqual([{ name: 'dni-print-1-copias.pdf', type: 'application/pdf', size: expect.any(Number) }])
})

test('Guardar en el teléfono descarga el PDF desde la hoja', async ({ page }) => {
  await fakeShare(page, 'resolve')
  await page.goto('./')
  await toPrint(page)
  await openSheet(page)
  const save = card(page, o.save.title.pdf)
  await expect(save).toBeEnabled()
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()])
  expect(download.suggestedFilename()).toBe('dni-print-2-copias.pdf')
  await expect(outputSheet(page).getByText(output.after.saved)).toBeVisible()
  expect(steps.print.primary).toBe('Está bien')
})
