import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { steps, doneStep } = strings

test('tras Borrar fotos no queda nada en el almacenamiento y la recarga arranca vacía', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: steps.print.primary, exact: true }).click(),
  ])
  await page.getByRole('button', { name: steps.done.primary, exact: true }).click()
  await expect(page.getByText(doneStep.cleared)).toBeVisible()

  const inspect = () =>
    page.evaluate(async () => {
      const dbs = (await indexedDB.databases?.()) ?? []
      let opfs = 0
      try {
        const root = await navigator.storage.getDirectory()
        for await (const _ of (root as unknown as { keys(): AsyncIterable<string> }).keys()) opfs++
      } catch {
        // OPFS unavailable: nothing stored.
      }
      const cacheNames = await caches.keys()
      let cacheEntries = 0
      for (const n of cacheNames) cacheEntries += (await (await caches.open(n)).keys()).length
      return { local: localStorage.length, session: sessionStorage.length, dbs: dbs.length, opfs, cacheEntries }
    })
  expect(await inspect()).toEqual({ local: 0, session: 0, dbs: 0, opfs: 0, cacheEntries: 0 })

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: steps.load.title })).toBeVisible()
  await expect(page.getByRole('button', { name: steps.load.primary, exact: true })).toBeDisabled()
})
