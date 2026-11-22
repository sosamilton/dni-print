import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'
import { installNetworkGuard, type NetworkGuard } from './network-guard.ts'

const { steps, doneStep } = strings
const wa = doneStep.whatsapp

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

async function toDone(page: Page) {
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: steps.print.primary, exact: true }).click(),
  ])
  await expect(page.getByRole('heading', { level: 1, name: steps.done.title })).toBeVisible()
}

async function openPanel(page: Page) {
  const others = page.getByText(doneStep.send.others)
  if (!(await page.getByLabel(wa.label).isVisible())) await others.click()
  return page.getByLabel(wa.label)
}

test('muestra el campo, rechaza un número inválido y abre WhatsApp Web con uno válido (escritorio)', async ({ page, context, guard }) => {
  await fakeShare(page, true)
  await page.goto('./')
  await toDone(page)

  await expect(page.getByLabel(wa.label)).toBeHidden()
  await expect(page.getByText(doneStep.send.attachHint)).toBeHidden()
  const field = await openPanel(page)
  await expect(field).toBeVisible()
  await expect(field).toHaveAttribute('type', 'tel')
  await expect(field).toHaveAttribute('inputmode', 'tel')
  await expect(field).toHaveAttribute('autocomplete', 'off')
  await expect(field).toHaveAccessibleDescription(wa.hint)
  await expect(page.getByText(doneStep.send.attachHint)).toBeVisible()

  let pages = 0
  context.on('page', () => pages++)
  const submit = page.getByRole('button', { name: doneStep.send.whatsappButton })

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
  const expected = `https://web.whatsapp.com/send?phone=5491123456789&text=${encodeURIComponent(wa.message)}`
  await expect.poll(() => guard.externalRequests()).toEqual([expected])
})

test('sin soporte para compartir archivos, Otras formas de enviar arranca abierta', async ({ page }) => {
  await fakeShare(page, false)
  await page.goto('./')
  await toDone(page)
  await expect(page.getByLabel(wa.label)).toBeVisible()
  await expect(page.getByText(doneStep.send.attachHint)).toBeVisible()
})

test('Empezar de nuevo vacía el número y no queda en almacenamiento', async ({ page }) => {
  await page.goto('./')
  await toDone(page)
  const field = await openPanel(page)
  await field.fill('011 15 2345-6789')

  await page.getByRole('button', { name: steps.done.primary, exact: true }).click()
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
    await expect(page.getByRole('button', { name: doneStep.desktop.useMailProgram })).toHaveCount(0)
    await expect(page.getByText(doneStep.desktop.dragHint)).toHaveCount(0)
    await expect(page.getByText(doneStep.send.attachHint)).toBeVisible()
    const field = await openPanel(page)
    await field.fill('011 15 2345-6789')
    const [popup] = await Promise.all([page.waitForEvent('popup'), field.press('Enter')])
    expect(popup).toBeTruthy()
    const expected = `https://wa.me/5491123456789?text=${encodeURIComponent(wa.message)}`
    await expect.poll(() => guard.externalRequests()).toEqual([expected])
  })
})
