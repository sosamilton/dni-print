import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'

const { menu } = strings

test('el HTML estático trae la vista previa con URLs absolutas de la build', async ({ request, baseURL }) => {
  const html = await (await request.get(baseURL!)).text()
  const meta = (attr: string, key: string) =>
    new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`).exec(html)?.[1]
  expect(meta('property', 'og:type')).toBe('website')
  expect(meta('property', 'og:locale')).toBe('es_AR')
  expect(meta('name', 'twitter:card')).toBe('summary_large_image')
  const ogUrl = meta('property', 'og:url')
  expect(ogUrl).toMatch(/^https:\/\/.+\/$/)
  expect(html).not.toContain('%CANONICAL_URL%')
  expect(html).not.toContain('%OG_IMAGE_URL%')
  expect(meta('property', 'og:image')).toBe(`${ogUrl}og-image.png`)
  expect(meta('name', 'twitter:image')).toBe(`${ogUrl}og-image.png`)
  expect(meta('property', 'og:image:width')).toBe('1200')
  expect(meta('property', 'og:image:height')).toBe('630')
  const image = await request.get('og-image.png')
  expect(image.ok()).toBe(true)
  expect((await image.body()).length).toBeLessThanOrEqual(300 * 1024)
})

test('«Compartir la app» con Web Share comparte la URL canónica', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __shared: unknown[] }).__shared = []
    Object.defineProperty(navigator, 'share', {
      value: async (data: unknown) => void (window as unknown as { __shared: unknown[] }).__shared.push(data),
      configurable: true,
    })
  })
  await page.goto('./')
  await page.getByRole('button', { name: menu.bar.shareApp, exact: true }).click()
  const shared = (await page.evaluate(() => (window as unknown as { __shared: { url: string; text: string }[] }).__shared))[0]
  expect(shared.text).toBe(strings.shareApp.text)
  expect(shared.url).toMatch(/^https:\/\/.+\/$/)
  expect(shared.url).not.toContain('?')
})

test('sin Web Share copia el enlace y ofrece abrir WhatsApp', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (t: string) => void ((window as unknown as { __copied: string }).__copied = t) },
      configurable: true,
    })
  })
  await page.goto('./')
  await page.getByRole('button', { name: menu.bar.shareApp, exact: true }).click()
  await expect(page.getByText(menu.shareAppCopied)).toBeVisible()
  const link = page.getByRole('link', { name: menu.shareAppWhatsapp })
  expect(await link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
  expect(await page.evaluate(() => (window as unknown as { __copied: string }).__copied)).toMatch(/^https:\/\//)

  // The note is a dismissible popover: Escape, «Cerrar» and a click outside hide it.
  const shareButton = page.getByRole('button', { name: menu.bar.shareApp, exact: true })
  const note = page.getByText(menu.shareAppCopied)
  await page.keyboard.press('Escape')
  await expect(note).toBeHidden()
  await expect(shareButton).toBeFocused()

  await shareButton.click()
  await expect(note).toBeVisible()
  await page.locator('.app-bar-popover').getByRole('button', { name: menu.close, exact: true }).click()
  await expect(note).toBeHidden()
  await expect(shareButton).toBeFocused()

  await shareButton.click()
  await expect(note).toBeVisible()
  await page.getByRole('heading', { level: 1 }).click()
  await expect(note).toBeHidden()
})

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('con Web Share, la hoja comparte y se cierra', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __shared: unknown[] }).__shared = []
      Object.defineProperty(navigator, 'share', {
        value: async (data: unknown) => void (window as unknown as { __shared: unknown[] }).__shared.push(data),
        configurable: true,
      })
    })
    await page.goto('./')
    await page.getByRole('button', { name: menu.buttonLabel }).click()
    const sheet = page.getByRole('dialog', { name: menu.sheetTitle })
    await sheet.getByRole('button', { name: menu.shareApp }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(1)
    await expect(sheet).toBeHidden()
  })

  test('sin Web Share, la hoja muestra «Enlace copiado» y el enlace a WhatsApp', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (t: string) => void ((window as unknown as { __copied: string }).__copied = t) },
        configurable: true,
      })
    })
    await page.goto('./')
    await page.getByRole('button', { name: menu.buttonLabel }).click()
    const sheet = page.getByRole('dialog', { name: menu.sheetTitle })
    await sheet.getByRole('button', { name: menu.shareApp }).click()
    await expect(sheet.getByRole('status').filter({ hasText: menu.shareAppCopied })).toBeVisible()
    const link = sheet.getByRole('link', { name: menu.shareAppWhatsapp })
    expect(await link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
    await expect(sheet).toBeVisible()
  })
})

test('el HTML estático trae canonical, JSON-LD y contenido indexable, y React lo reemplaza al montar', async ({ request, baseURL, page }) => {
  const html = await (await request.get(baseURL!)).text()
  const canonical = /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/.exec(html)?.[1]
  expect(canonical).toMatch(/^https:\/\/.+\/$/)
  expect(html).toContain('lang="es-AR"')
  expect(html.match(/<h1\b/g)).toHaveLength(1)
  expect(html).toContain('application/ld+json')
  expect((await request.get('sitemap.xml')).ok()).toBe(true)
  expect(await (await request.get('robots.txt')).text()).toContain(`Sitemap: ${canonical}sitemap.xml`)
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Preguntas frecuentes' })).toHaveCount(0)
})
