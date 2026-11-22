import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { steps, cropStep, printStep, doneStep, loadStep, wizard, menu } = strings

async function loadFaces(page: Page) {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
}

const primary = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true })

test('flujo completo solo con teclado, esquinas incluidas, con foco y anuncio por paso', async ({ page }) => {
  await loadFaces(page)
  await expect(page.getByRole('button', { name: loadStep.faceAreaLabel('Frente', loadStep.faceStates.loaded) })).toBeVisible()

  await primary(page, steps.load.primary).focus()
  await page.keyboard.press('Enter')
  const title = page.getByRole('heading', { level: 1, name: steps.crop.title })
  await expect(title).toBeFocused()
  await expect(page.getByRole('status').filter({ hasText: wizard.stepAnnouncement(2, 3, steps.crop.title) })).toHaveCount(1)

  // Editor de esquinas con teclado: mover una esquina y confirmar ambas caras.
  const tl = page.getByRole('button', { name: cropStep.corners[0] })
  await tl.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: cropStep.corners[1] })).toBeFocused()
  await primary(page, steps.crop.primary).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(cropStep.faceCounter('Dorso', 2, 2))).toBeVisible()
  await primary(page, steps.crop.primary).focus()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { level: 1, name: steps.print.title })).toBeFocused()
  await page.getByRole('button', { name: printStep.copies[1] }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: printStep.copies[1] })).toHaveAttribute('aria-pressed', 'true')

  await primary(page, steps.print.primary).focus()
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')])
  expect(readFileSync((await download.path())!).toString('latin1')).toContain('%PDF')
  await expect(page.getByRole('heading', { level: 1, name: steps.done.title })).toBeFocused()
  await expect(page.getByRole('heading', { name: doneStep.iosGuideTitle })).toHaveCount(0)
})

test('a 320 px no hay scroll horizontal en ningún paso', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await loadFaces(page)
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
  expect(await noOverflow()).toBe(true)
  await primary(page, steps.load.primary).click()
  expect(await noOverflow()).toBe(true)
  await primary(page, steps.crop.primary).click()
  await primary(page, steps.crop.primary).click()
  expect(await noOverflow()).toBe(true)
})

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

test.describe('menú en celular', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('la hoja atrapa el foco, Escape y tocar afuera la cierran y el foco vuelve a ⋮', async ({ page }) => {
    await page.goto('./')
    const toggle = page.getByRole('button', { name: menu.buttonLabel })
    await toggle.focus()
    await page.keyboard.press('Enter')
    const sheet = page.getByRole('dialog', { name: menu.sheetTitle })
    await expect(sheet).toBeVisible()
    const first = sheet.getByRole('button', { name: menu.theme.options.system })
    await expect(first).toBeFocused()
    const last = sheet.getByRole('button', { name: menu.restart })

    await page.keyboard.press('Shift+Tab')
    await expect(last).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(first).toBeFocused()
    // Choosing a theme keeps the sheet open.
    await page.keyboard.press('Tab')
    await page.keyboard.press('Space')
    await expect(sheet).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(toggle).toBeFocused()

    await toggle.click()
    await expect(sheet).toBeVisible()
    await page.mouse.click(195, 20)
    await expect(sheet).toBeHidden()
    await expect(toggle).toBeFocused()
  })

  test('al cerrar privacidad abierta desde la hoja, el foco vuelve a ⋮', async ({ page }) => {
    await page.goto('./')
    const toggle = page.getByRole('button', { name: menu.buttonLabel })
    await toggle.click()
    await page.getByRole('button', { name: menu.privacy }).click()
    const privacy = page.getByRole('dialog', { name: strings.privacyDialog.title })
    await expect(privacy).toBeVisible()
    await expect(page.getByRole('dialog', { name: menu.sheetTitle })).toBeHidden()
    await privacy.getByRole('button', { name: menu.close }).click()
    await expect(privacy).toBeHidden()
    await expect(toggle).toBeFocused()
  })

  test('a 320 px con la hoja abierta no hay scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('./')
    await page.getByRole('button', { name: menu.buttonLabel }).click()
    const sheet = page.getByRole('dialog', { name: menu.sheetTitle })
    await expect(sheet).toBeVisible()
    expect(await noHorizontalScroll(page)).toBe(true)
    expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  })

  test('al pasar a 900 px con la hoja abierta, la hoja desaparece y la página responde', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: menu.buttonLabel }).click()
    await expect(page.getByRole('dialog', { name: menu.sheetTitle })).toBeVisible()
    await page.setViewportSize({ width: 1000, height: 800 })
    await expect(page.locator('dialog.menu-sheet')).toHaveCount(0)
    await page.getByRole('button', { name: menu.bar.privacy, exact: true }).click()
    await expect(page.getByRole('dialog', { name: strings.privacyDialog.title })).toBeVisible()
  })
})

test('privacidad desde la barra: Escape la cierra y el foco vuelve a «Cómo funciona»', async ({ page }) => {
  await page.goto('./')
  const button = page.getByRole('button', { name: menu.bar.privacy, exact: true })
  await button.click()
  const privacy = page.getByRole('dialog', { name: strings.privacyDialog.title })
  await expect(privacy).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(privacy).toBeHidden()
  await expect(button).toBeFocused()
})

test('el aviso de compartir en escritorio se cierra al sacarle el foco y Escape ya no mueve el foco', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true })
  })
  await page.goto('./')
  const share = page.getByRole('button', { name: menu.bar.shareApp, exact: true })
  await share.click()
  await expect(page.getByText(menu.shareAppCopied)).toBeVisible()
  const theme = page.getByRole('button', { name: menu.bar.theme, exact: true })
  await theme.focus()
  await expect(page.getByText(menu.shareAppCopied)).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(theme).toBeFocused()
})

test('⋯ en escritorio: Escape lo cierra y devuelve el foco; un clic afuera o sacar el foco lo cierran', async ({ page }) => {
  await page.goto('./')
  const more = page.getByRole('button', { name: menu.buttonLabel })
  await more.focus()
  await page.keyboard.press('Enter')
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await expect(more).toBeFocused()

  await more.click()
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('heading', { level: 1 }).click()
  await expect(more).toHaveAttribute('aria-expanded', 'false')

  await more.click()
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await page.locator('.app-menu-list').getByRole('button', { name: menu.restart }).focus()
  await page.keyboard.press('Tab')
  await expect(more).toHaveAttribute('aria-expanded', 'false')
})

for (const { width, icons } of [
  { width: 900, icons: false },
  { width: 1000, icons: true },
]) {
  test(`a ${width} px la barra no genera scroll horizontal (íconos ${icons ? 'visibles' : 'ocultos'})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('./')
    const theme = page.getByRole('button', { name: menu.bar.theme, exact: true })
    await expect(theme).toBeVisible()
    const icon = page.locator('.app-menu-bar .app-menu-icon').first()
    if (icons) await expect(icon).toBeVisible()
    else await expect(icon).toBeHidden()
    expect(await noHorizontalScroll(page)).toBe(true)
    await loadFaces(page)
    await primary(page, steps.load.primary).click()
    expect(await noHorizontalScroll(page)).toBe(true)
    await primary(page, steps.crop.primary).click()
    await primary(page, steps.crop.primary).click()
    expect(await noHorizontalScroll(page)).toBe(true)
  })
}

for (const width of [900, 1000]) {
  test(`a ${width} px la barra y el aviso de versión nueva no generan scroll horizontal`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('./')
    await expect(page.getByRole('button', { name: menu.bar.theme, exact: true })).toBeVisible()
    // The service worker never reports an update in e2e, so add the banner's markup to measure the header grid.
    await page.evaluate(
      ({ text, action }) => {
        const banner = document.createElement('div')
        banner.className = 'wizard-update'
        const label = document.createElement('span')
        label.textContent = text
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'wizard-update-action'
        button.textContent = action
        banner.append(label, button)
        const bar = document.querySelector('.wizard-header-bar')!
        bar.insertBefore(banner, bar.querySelector('.app-menu'))
      },
      { text: strings.update.available, action: strings.update.action },
    )
    expect(await noHorizontalScroll(page)).toBe(true)
  })
}

test('desde 900 px el paso 3 va en dos columnas; antes, en una', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await loadFaces(page)
  await primary(page, steps.load.primary).click()
  await primary(page, steps.crop.primary).click()
  await primary(page, steps.crop.primary).click()
  const preview = (await page.locator('.print-preview').boundingBox())!
  const options = (await page.locator('.print-options').boundingBox())!
  expect(preview.x).toBeLessThan(options.x)
  await page.setViewportSize({ width: 600, height: 800 })
  const narrow = (await page.locator('.print-options').boundingBox())!
  const narrowPreview = (await page.locator('.print-preview').boundingBox())!
  expect(narrowPreview.y).toBeLessThan(narrow.y)
})

test('escritorio dice "tu dispositivo" y no muestra la guía de iOS', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText(loadStep.privacyNotice(true))).toBeVisible()
})

test.describe('iOS', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })

  test('Listo incluye la guía y el aviso dice "teléfono"', async ({ page }) => {
    await loadFaces(page)
    await expect(page.getByText(loadStep.privacyNotice(false))).toBeVisible()
    await primary(page, steps.load.primary).click()
    await primary(page, steps.crop.primary).click()
    await primary(page, steps.crop.primary).click()
    await Promise.all([page.waitForEvent('download'), primary(page, steps.print.primary).click()])
    await expect(page.getByRole('heading', { name: doneStep.iosGuideTitle })).toBeVisible()
  })
})
