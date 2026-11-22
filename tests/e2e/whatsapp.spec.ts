import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { savePdf, toPrint } from './output.ts'
import { installNetworkGuard, type NetworkGuard } from './network-guard.ts'

const { steps, output } = strings
const wa = output.whatsapp

const test = base.extend<{ guard: NetworkGuard }>({
  guard: async ({ context, baseURL }, provide) => {
    if (!baseURL) throw new Error('Falta baseURL en playwright.config.ts')
    await provide(await installNetworkGuard(context, new URL(baseURL).origin))
  },
})

/** Fake Web Share API that can (or cannot) share files; only `canShare` matters here. */
async function fakeShare(page: Page, files: boolean) {
  await page.addInitScript((canShareFiles: boolean) => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: { files?: File[] }) => canShareFiles && !!data.files?.length,
    })
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => Promise.resolve() })
  }, files)
}

const toDone = toPrint

async function openPanel(page: Page) {
  const others = page.getByText(output.options.send.title)
  if (!(await page.getByLabel(wa.label).isVisible())) await others.click()
  return page.getByLabel(wa.label)
}

test('muestra el campo, rechaza un número inválido y abre WhatsApp Web con uno válido (escritorio)', async ({ page, context, guard }) => {
  await fakeShare(page, true)
  await page.goto('./')
  await toDone(page)

  await expect(page.getByLabel(wa.label)).toBeHidden()
  const field = await openPanel(page)
  await expect(field).toBeVisible()
  await expect(field).toHaveAttribute('type', 'tel')
  await expect(field).toHaveAttribute('inputmode', 'tel')
  await expect(field).toHaveAttribute('autocomplete', 'off')
  await expect(field).toHaveAccessibleDescription(wa.hint)

  let downloads = 0
  page.on('download', () => downloads++)
  let pages = 0
  context.on('page', () => pages++)
  const submit = page.getByRole('button', { name: output.send.whatsappButton })

  await submit.click()
  await expect(page.getByRole('alert')).toHaveText(wa.empty)

  await field.fill('+1 555 123 4567')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await submit.click()
  await expect(page.getByRole('alert')).toHaveText(wa.invalid)
  await page.waitForTimeout(300)
  expect(pages).toBe(0)
  expect(guard.externalRequests()).toEqual([])

  await field.fill('011 15 2345-6789')
  const [popup] = await Promise.all([page.waitForEvent('popup'), submit.click()])
  expect(popup).toBeTruthy()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(downloads).toBe(0)
  await expect(page.getByText(/Guardamos .* en Descargas/)).toHaveCount(0)
  const expected = `https://web.whatsapp.com/send?phone=5491123456789&text=${encodeURIComponent(wa.message)}`
  await expect.poll(() => guard.externalRequests()).toEqual([expected])
})

test('sin soporte para compartir archivos, Mandar arranca abierta', async ({ page }) => {
  await fakeShare(page, false)
  await page.goto('./')
  await toDone(page)
  await expect(page.getByLabel(wa.label)).toBeVisible()
})

test('sin Web Share, mandar a un número descarga el PDF, abre WhatsApp y muestra la indicación; un número inválido no descarga', async ({ page }) => {
  await fakeShare(page, false)
  let downloads = 0
  page.on('download', () => downloads++)
  await page.goto('./')
  await toDone(page)
  const field = page.getByLabel(wa.label)
  const submit = page.getByRole('button', { name: output.send.whatsappButton })
  await field.fill('123')
  await submit.click()
  await expect(page.getByRole('alert')).toHaveText(wa.invalid)
  expect(downloads).toBe(0)
  await field.fill('011 15 2345-6789')
  const [popup, download] = await Promise.all([page.waitForEvent('popup'), page.waitForEvent('download'), submit.click()])
  expect(popup).toBeTruthy()
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  await expect(page.getByText(/Guardamos .* en Descargas/)).toBeVisible()
})

test('el número y el mail guardados en preferencias prellenan los campos, editables', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('dni-print:prefs')) {
      localStorage.setItem('dni-print:prefs', JSON.stringify({ v: 1, whatsapp: '011 15 2345-6789', email: 'a@b.com' }))
    }
  })
  await page.goto('./')
  await toDone(page)
  const field = await openPanel(page)
  await expect(field).toHaveValue('011 15 2345-6789')
  await expect(page.getByLabel(strings.output.desktop.emailLabel)).toHaveValue('a@b.com')
  await field.fill('11 5555 0000')
  await page.getByLabel(strings.output.desktop.emailLabel).fill('otro@ejemplo.com')
  await savePdf(page)
  await page.getByRole('button', { name: output.restart, exact: true }).click()
  await toDone(page)
  await expect(await openPanel(page)).toHaveValue('011 15 2345-6789')
  await expect(page.getByLabel(strings.output.desktop.emailLabel)).toHaveValue('a@b.com')
})

test('Empezar de nuevo vacía el número y no queda en almacenamiento', async ({ page }) => {
  await page.goto('./')
  await toDone(page)
  const field = await openPanel(page)
  await field.fill('011 15 2345-6789')

  await savePdf(page)
  await page.getByRole('button', { name: output.restart, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.load.title })).toBeVisible()
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
  expect(stored).not.toContain('2345')

  await toDone(page)
  await expect(await openPanel(page)).toHaveValue('')
})

test.describe('celular', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' })

  test('abre wa.me y no muestra lo exclusivo de escritorio; Enter envía', async ({ page, guard }) => {
    await page.goto('./')
    await toDone(page)
    await expect(page.getByRole('button', { name: output.desktop.useMailProgram })).toHaveCount(0)
    const field = await openPanel(page)
    await field.fill('011 15 2345-6789')
    const [popup] = await Promise.all([page.waitForEvent('popup'), field.press('Enter')])
    expect(popup).toBeTruthy()
    const expected = `https://wa.me/5491123456789?text=${encodeURIComponent(wa.message)}`
    await expect.poll(() => guard.externalRequests()).toEqual([expected])
  })
})
