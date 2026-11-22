import { expect, test, type Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { card, toPrint } from './output.ts'

const { menu, preferences: p, output } = strings

async function openPrefs(page: Page) {
  await page.getByRole('button', { name: menu.buttonLabel }).click()
  await page.getByRole('button', { name: menu.preferences }).click()
  const dialog = page.getByRole('dialog', { name: p.title })
  await expect(dialog).toBeVisible()
  return dialog
}

test('con showDirectoryPicker: elegir carpeta, Guardar escribe ahí sin descargar y Borrar la quita', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'OPFS como carpeta simulada, solo chromium')
  // Stub: la carpeta elegida es un directorio real de OPFS (un handle clonable para IndexedDB).
  await page.addInitScript(() => {
    ;(window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory()
      return root.getDirectoryHandle('Imprentas', { create: true })
    }
  })
  let downloads = 0
  page.on('download', () => downloads++)
  await page.goto('./')

  let dialog = await openPrefs(page)
  await expect(dialog).toContainText(p.folderNone)
  await dialog.getByRole('button', { name: p.folderPick, exact: true }).click()
  await expect(dialog).toContainText(p.folderChosen('Imprentas'))
  await page.keyboard.press('Escape')

  await toPrint(page)
  const save = card(page, output.options.save.title.pdf)
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.getByText(output.after.saved)).toBeVisible()
  expect(downloads).toBe(0)
  const files = await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Imprentas')
    const names: string[] = []
    for await (const [name] of (dir as unknown as { entries(): AsyncIterable<[string, unknown]> }).entries()) names.push(name)
    return names
  })
  expect(files).toHaveLength(1)
  expect(files[0]).toMatch(/\.pdf$/)

  dialog = await openPrefs(page)
  await dialog.getByRole('button', { name: p.erase, exact: true }).click()
  await expect(dialog).toContainText(p.folderNone)
  const dbs = await page.evaluate(async () => ((await indexedDB.databases?.()) ?? []).length)
  expect(dbs).toBe(0)
})

test('sin showDirectoryPicker: explicación y descarga normal', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker
  })
  await page.goto('./')
  const dialog = await openPrefs(page)
  await expect(dialog).toContainText(p.folderUnsupported)
  await expect(dialog.getByRole('button', { name: p.folderPick })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await toPrint(page)
  const [download] = await Promise.all([page.waitForEvent('download'), card(page, output.options.save.title.pdf).click()])
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
})
