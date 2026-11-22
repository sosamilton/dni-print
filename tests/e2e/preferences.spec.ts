import { expect, test, type Page } from '@playwright/test'
import { PREFS_KEY } from '../../src/ui/preferences.ts'
import { strings } from '../../src/ui/strings.es.ts'
import { card, toPrint } from './output.ts'

const { menu, preferences: p, printStep, output } = strings

async function openPrefs(page: Page) {
  await page.getByRole('button', { name: menu.buttonLabel }).click()
  await page.getByRole('button', { name: menu.preferences }).click()
  const dialog = page.getByRole('dialog', { name: p.title })
  await expect(dialog).toBeVisible()
  return dialog
}

test('guardar, recargar sin conexión y empezar un trámite con esos valores; Borrar deja todo vacío', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'setOffline con service workers es confiable en chromium')
  await page.goto('./')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  let dialog = await openPrefs(page)
  await expect(dialog).toContainText(p.intro)
  await expect(dialog).toContainText(p.restartNote)

  // Un valor inválido no guarda.
  await dialog.getByLabel(p.emailLabel).fill('mal')
  await dialog.locator('button[type=submit]').click()
  await expect(dialog.getByText(p.invalidEmail)).toBeVisible()
  expect(await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)).toBeNull()

  await dialog.getByRole('button', { name: menu.theme.options.dark, exact: true }).click()
  await dialog.locator('.prefs-option', { hasText: p.defaultActions.save }).click()
  await dialog.getByRole('button', { name: printStep.copies[1], exact: true }).click()
  await dialog.getByRole('button', { name: printStep.filters.bn, exact: true }).click()
  await dialog.getByLabel(p.marginLabel).fill('15')
  await dialog.getByLabel(p.watermarkLabel).fill('COPIA')
  await dialog.getByLabel(p.emailLabel).fill('a@b.com')
  await dialog.locator('button[type=submit]').click()
  await expect(dialog.getByText(p.saved)).toBeVisible()
  const raw = await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)
  expect(JSON.parse(raw!)).toEqual({
    v: 1,
    theme: 'dark',
    email: 'a@b.com',
    defaultAction: 'save',
    copies: 1,
    filter: 'bn',
    marginMm: 15,
    watermark: 'COPIA',
  })
  await page.keyboard.press('Escape')

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await toPrint(page)
  await expect(page.getByRole('button', { name: printStep.copies[1] })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: printStep.filters.bn })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('input[type=range]')).toHaveValue('15')
  await expect(page.getByLabel(printStep.watermarkField)).toHaveValue('COPIA')
  await expect(card(page, output.options.save.title.pdf)).toHaveAttribute('data-highlighted', 'true')
  await expect(card(page, output.options.print.title)).toHaveAttribute('data-highlighted', 'false')

  // Borrar preferencias.
  await page.reload()
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('dni-print-prefs')
        req.onsuccess = () => {
          req.result.close()
          resolve()
        }
        req.onerror = () => reject(req.error)
      }),
  )
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBeGreaterThan(0)
  dialog = await openPrefs(page)
  await dialog.getByRole('button', { name: p.erase, exact: true }).click()
  await expect(dialog.getByText(p.erased)).toBeVisible()
  const state = await page.evaluate(async (k) => ({
    prefs: localStorage.getItem(k),
    keys: Object.keys(localStorage),
    dbs: ((await indexedDB.databases?.()) ?? []).length,
    theme: document.documentElement.getAttribute('data-theme'),
  }), PREFS_KEY)
  expect(state).toEqual({ prefs: null, keys: [], dbs: 0, theme: null })
})
