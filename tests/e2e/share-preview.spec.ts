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

test('«Compartir DNI Print» con Web Share comparte la URL canónica', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __shared: unknown[] }).__shared = []
    Object.defineProperty(navigator, 'share', {
      value: async (data: unknown) => void (window as unknown as { __shared: unknown[] }).__shared.push(data),
      configurable: true,
    })
  })
  await page.goto('./')
  await page.getByRole('button', { name: menu.buttonLabel }).click()
  await page.getByRole('button', { name: menu.shareApp }).click()
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
  await page.getByRole('button', { name: menu.buttonLabel }).click()
  await page.getByRole('button', { name: menu.shareApp }).click()
  await expect(page.getByText(menu.shareAppCopied)).toBeVisible()
  const link = page.getByRole('link', { name: menu.shareAppWhatsapp })
  expect(await link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
  expect(await page.evaluate(() => (window as unknown as { __copied: string }).__copied)).toMatch(/^https:\/\//)
})
