import { expect, test, type Page } from '@playwright/test'
import { PREFS_KEY } from '../../src/ui/preferences.ts'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { steps, doneStep, menu } = strings

async function completeAndRestart(page: Page) {
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
}

const inspect = (page: Page) =>
  page.evaluate(async (prefsKey) => {
    const dbs = (await indexedDB.databases?.()) ?? []
    let opfs = 0
    try {
      const root = await navigator.storage.getDirectory()
      for await (const _ of (root as unknown as { keys(): AsyncIterable<string> }).keys()) opfs++
    } catch {
      // OPFS unavailable: nothing stored.
    }
    // Cache Storage may hold only the build's own assets (the SW precache), never photos or PDFs.
    let cacheEntries = 0
    for (const n of await caches.keys()) {
      for (const req of await (await caches.open(n)).keys()) {
        if (!new URL(req.url).pathname.startsWith(new URL(document.baseURI).pathname)) cacheEntries++
        else if (/^blob:|\.pdf$|\.(jpe?g)$/i.test(req.url)) cacheEntries++
      }
    }
    const localKeys = Object.keys(localStorage)
    return {
      localKeys,
      prefs: localStorage.getItem(prefsKey),
      session: sessionStorage.length,
      dbs: dbs.length,
      opfs,
      cacheEntries,
    }
  }, PREFS_KEY)

test('tras Empezar de nuevo no queda nada en el almacenamiento y la recarga arranca vacía', async ({ page }) => {
  await page.goto('./')
  await completeAndRestart(page)
  expect(await inspect(page)).toEqual({ localKeys: [], prefs: null, session: 0, dbs: 0, opfs: 0, cacheEntries: 0 })

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: steps.load.title })).toBeVisible()
  await expect(page.getByRole('button', { name: steps.load.primary, exact: true })).toBeDisabled()
})

test('con un tema elegido, Empezar de nuevo deja solo la clave de preferencias, sin imágenes ni PDF', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: menu.buttonLabel }).click()
  await page.getByRole('group', { name: menu.theme.label }).getByRole('button', { name: menu.theme.options.dark }).click()
  await page.keyboard.press('Escape')
  await completeAndRestart(page)

  const state = await inspect(page)
  expect(state).toMatchObject({ localKeys: [PREFS_KEY], session: 0, dbs: 0, opfs: 0, cacheEntries: 0 })
  expect(state.prefs).toBe('{"v":1,"theme":"dark"}')
  expect(state.prefs).not.toMatch(/data:|blob:|%PDF/)
})
