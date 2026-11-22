import { expect, type Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { steps, output } = strings

/** Loads both faces and confirms both crops: lands on step 3 «Revisá la hoja». */
export async function toPrint(page: Page, file = pngFile) {
  await page.getByTestId('front-gallery').setInputFiles(file())
  await page.getByTestId('back-gallery').setInputFiles(file())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.print.title })).toBeVisible()
}

/** The output options: the side panel (>= 900px) or the bottom sheet (< 900px, after «Está bien»). */
export const outputSheet = (page: Page) => page.getByRole('dialog', { name: output.title })

/** An output card by its title (its help line is the description, not part of the name). */
export const card = (page: Page, title: string) => page.getByRole('button', { name: title, exact: true })

/** Below 900px: taps «Está bien» and returns the open sheet. */
export async function openSheet(page: Page) {
  await page.getByRole('button', { name: steps.print.primary, exact: true }).click()
  const sheet = outputSheet(page)
  await expect(sheet).toBeVisible()
  return sheet
}

/** Clicks «Guardar …» once the PDF is ready and returns the download. */
export async function savePdf(page: Page, title: string = output.options.save.title.pdf) {
  const save = card(page, title)
  await expect(save).toBeEnabled()
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()])
  await expect(page.getByText(output.after.saved)).toBeVisible()
  return download
}

/**
 * Holds every `buildPdf` call sent to the worker until `releasePdfBuilds`, so «Preparando PDF…» can be
 * asserted without racing the build. Call before `page.goto`.
 */
export async function holdPdfBuilds(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __holdPdf: boolean; __failPdf: boolean; __heldPdf: (() => void)[]; __releasePdf: () => void }
    w.__holdPdf = false
    w.__failPdf = false
    w.__heldPdf = []
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (this: Worker, ...args: Parameters<Worker['postMessage']>) {
      const message = args[0] as { path?: unknown } | null
      if (w.__holdPdf && Array.isArray(message?.path) && message.path[0] === 'buildPdf') {
        w.__heldPdf.push(() => post.apply(this, args))
        return
      }
      if (w.__failPdf && Array.isArray(message?.path) && message.path[0] === 'buildPdf') {
        // A path the worker does not expose makes Comlink reject the call.
        args[0] = { ...(message as object), path: ['noExisteBuildPdf'] }
      }
      post.apply(this, args)
    } as Worker['postMessage']
    w.__releasePdf = () => {
      w.__holdPdf = false
      for (const send of w.__heldPdf.splice(0)) send()
    }
  })
}

export const setHoldPdf = (page: Page, hold: boolean) =>
  page.evaluate((h) => {
    const w = window as unknown as { __holdPdf: boolean; __releasePdf: () => void }
    if (h) w.__holdPdf = true
    else w.__releasePdf()
  }, hold)

/** Makes every later `buildPdf` fail in the worker (needs `holdPdfBuilds` before `page.goto`). */
export const setFailPdf = (page: Page, fail: boolean) =>
  page.evaluate((f) => {
    ;(window as unknown as { __failPdf: boolean }).__failPdf = f
  }, fail)
