import { expect, test, type Page } from '@playwright/test'
import { PREFS_KEY } from '../../src/ui/preferences.ts'
import { strings } from '../../src/ui/strings.es.ts'

const { menu } = strings
const KEY = PREFS_KEY
const LIGHT_BG = 'rgb(251, 250, 247)' // #FBFAF7
const DARK_BG = 'rgb(18, 24, 29)' // #12181D
const DARK_THEME_COLOR = '#12202E'
const LIGHT_THEME_COLOR = '#FBFAF7'

const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const themeAttr = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'))
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY)
const themeColors = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content')))

async function openMenu(page: Page) {
  await page.getByRole('button', { name: menu.buttonLabel }).click()
  return page.getByRole('group', { name: menu.theme.label })
}

/** Records `data-theme` the moment <body> is inserted, before any app script runs. */
async function watchBodyInsertion(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __themeAtBody?: string | null }
    const observer = new MutationObserver(() => {
      if (!document.body) return
      w.__themeAtBody = document.documentElement.getAttribute('data-theme')
      observer.disconnect()
    })
    observer.observe(document, { childList: true, subtree: true })
  })
}

test('Oscuro cambia el fondo sin recargar, se guarda y se aplica antes del primer pintado', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./')
  expect(await bodyBg(page)).toBe(LIGHT_BG)
  await page.evaluate(() => ((window as unknown as { __sameDocument: boolean }).__sameDocument = true))

  const group = await openMenu(page)
  const dark = group.getByRole('button', { name: menu.theme.options.dark })
  await dark.click()
  await expect(dark).toHaveAttribute('aria-pressed', 'true')
  await expect(group.getByRole('button', { name: menu.theme.options.system })).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => bodyBg(page)).toBe(DARK_BG)
  expect(await themeAttr(page)).toBe('dark')
  expect(await stored(page)).toBe('{"v":1,"theme":"dark"}')
  expect(await themeColors(page)).toEqual([DARK_THEME_COLOR, DARK_THEME_COLOR])
  // Same document: no reload happened, and the menu stays open.
  expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true)
  await expect(group).toBeVisible()

  await watchBodyInsertion(page)
  await page.reload()
  expect(await page.evaluate(() => (window as unknown as { __themeAtBody?: string | null }).__themeAtBody)).toBe('dark')
  expect(await themeColors(page)).toEqual([DARK_THEME_COLOR, DARK_THEME_COLOR])
  expect(await bodyBg(page)).toBe(DARK_BG)
  await expect((await openMenu(page)).getByRole('button', { name: menu.theme.options.dark })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('Sistema borra la clave y sigue prefers-color-scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./')
  const group = await openMenu(page)
  await group.getByRole('button', { name: menu.theme.options.dark }).click()
  expect(await stored(page)).not.toBeNull()

  const system = group.getByRole('button', { name: menu.theme.options.system })
  await system.click()
  await expect(system).toHaveAttribute('aria-pressed', 'true')
  expect(await themeAttr(page)).toBeNull()
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
  expect(await themeColors(page)).toEqual([LIGHT_THEME_COLOR, DARK_THEME_COLOR])
  await expect.poll(() => bodyBg(page)).toBe(LIGHT_BG)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(() => bodyBg(page)).toBe(DARK_BG)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect.poll(() => bodyBg(page)).toBe(LIGHT_BG)
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
})

test('Claro guardado gana sobre el sistema oscuro desde el primer pintado', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript((k) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(k, '{"v":1,"theme":"light"}')
      sessionStorage.setItem('seeded', '1')
    }
  }, KEY)
  await watchBodyInsertion(page)
  await page.goto('./')
  expect(await page.evaluate(() => (window as unknown as { __themeAtBody?: string | null }).__themeAtBody)).toBe('light')
  expect(await bodyBg(page)).toBe(LIGHT_BG)
  expect(await themeColors(page)).toEqual([LIGHT_THEME_COLOR, LIGHT_THEME_COLOR])
  await expect((await openMenu(page)).getByRole('button', { name: menu.theme.options.light })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('una clave inválida se trata como Sistema', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript((k) => localStorage.setItem(k, '{"v":9,"theme":"dark"'), KEY)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  expect(await themeAttr(page)).toBeNull()
  expect(await bodyBg(page)).toBe(DARK_BG)
  await expect((await openMenu(page)).getByRole('button', { name: menu.theme.options.system })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(errors).toEqual([])
})

/** Computed `::backdrop` background of the open privacy dialog, and the same mix resolved from a reference element. */
async function backdropVsReference(page: Page, reference: string) {
  return page.evaluate((ref) => {
    const dialog = document.querySelector('dialog[open]')
    if (!dialog) return null
    const probe = document.createElement('div')
    probe.style.background = ref
    document.body.append(probe)
    const expected = getComputedStyle(probe).backgroundColor
    probe.remove()
    return { actual: getComputedStyle(dialog, '::backdrop').backgroundColor, expected }
  }, reference)
}

async function seedTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(k, v)
        sessionStorage.setItem('seeded', '1')
      }
    },
    [KEY, JSON.stringify({ v: 1, theme })] as const,
  )
}

for (const { theme, system, reference } of [
  { theme: 'dark', system: 'light', reference: 'color-mix(in srgb, #12181D 75%, transparent)' },
  { theme: 'light', system: 'dark', reference: 'color-mix(in srgb, #1D2730 40%, transparent)' },
] as const) {
  test(`el fondo del diálogo de privacidad sigue el tema ${theme} guardado con sistema ${system}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: system })
    await seedTheme(page, theme)
    await page.goto('./')
    await page.getByRole('button', { name: menu.buttonLabel }).click()
    await page.getByRole('button', { name: menu.privacy }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const result = await backdropVsReference(page, reference)
    expect(result).not.toBeNull()
    expect(result!.actual).toBe(result!.expected)
  })
}
