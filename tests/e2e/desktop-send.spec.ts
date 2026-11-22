import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'
import { installNetworkGuard, type NetworkGuard } from './network-guard.ts'

const { steps, doneStep } = strings
const d = doneStep.desktop
const wa = doneStep.whatsapp

const test = base.extend<{ guard: NetworkGuard }>({
  guard: async ({ context, baseURL }, provide) => {
    if (!baseURL) throw new Error('Falta baseURL en playwright.config.ts')
    await provide(await installNetworkGuard(context, new URL(baseURL).origin))
  },
})

async function fakeShare(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => Promise.resolve() })
  })
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

test('sin Web Share aparecen los botones y abren Gmail y WhatsApp Web', async ({ page, guard }) => {
  await page.goto('./')
  await toDone(page)
  await expect(page.getByRole('button', { name: d.sendMail })).toBeVisible()
  await expect(page.getByRole('button', { name: d.sendWhatsappWeb })).toBeVisible()
  await expect(page.getByText(d.dragHint)).toBeVisible()

  await page.getByLabel(d.emailLabel).fill('mal')
  await page.getByRole('button', { name: d.sendMail }).click()
  await expect(page.getByRole('alert')).toHaveText(d.emailInvalid)

  await page.getByLabel(d.emailLabel).fill('imprenta@ejemplo.com')
  const [mail] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: d.sendMail }).click()])
  expect(mail).toBeTruthy()

  await page.getByRole('button', { name: d.sendWhatsappWeb }).click()
  await expect(page.getByRole('alert')).toHaveText(wa.empty)
  await page.getByLabel(wa.label).fill('011 15 2345-6789')
  const [chat] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: d.sendWhatsappWeb }).click()])
  expect(chat).toBeTruthy()

  const requests = guard.externalRequests()
  expect(requests.some((u) => u.startsWith('https://mail.google.com/mail/?view=cm&fs=1&to=imprenta%40ejemplo.com'))).toBe(true)
  expect(requests).toContain(`https://web.whatsapp.com/send?phone=5491123456789&text=${encodeURIComponent(wa.message)}`)
})

test('con Web Share no aparecen los botones de escritorio', async ({ page }) => {
  await fakeShare(page)
  await page.goto('./')
  await toDone(page)
  await expect(page.getByRole('button', { name: doneStep.share })).toBeVisible()
  await expect(page.getByRole('button', { name: d.sendMail })).toHaveCount(0)
  await expect(page.getByRole('button', { name: d.sendWhatsappWeb })).toHaveCount(0)
})

test('Empezar de nuevo vacía el correo', async ({ page }) => {
  await page.goto('./')
  await toDone(page)
  await page.getByLabel(d.emailLabel).fill('a@b.com')
  await page.getByRole('button', { name: steps.done.primary, exact: true }).click()
  await toDone(page)
  await expect(page.getByLabel(d.emailLabel)).toHaveValue('')
})
