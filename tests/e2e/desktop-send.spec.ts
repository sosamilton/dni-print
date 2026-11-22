import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { card, savePdf, toPrint } from './output.ts'
import { installNetworkGuard, type NetworkGuard } from './network-guard.ts'

const { output } = strings
const d = output.desktop
const wa = output.whatsapp
const send = output.send

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


test('sin Web Share Mandar arranca abierta, sus botones abren Gmail y WhatsApp Web descargan el PDF con la indicación', async ({ page, guard }) => {
  let downloads = 0
  page.on('download', () => downloads++)
  await page.goto('./')
  await toPrint(page)
  await expect(page.getByRole('button', { name: d.sendMail })).toBeVisible()
  await expect(page.getByRole('button', { name: send.whatsappButton })).toBeVisible()
  await expect(page.getByText(send.attachHint)).toHaveCount(0)
  await expect(page.getByRole('button', { name: d.useMailProgram })).toBeVisible()

  await page.getByLabel(d.emailLabel).fill('mal')
  await page.getByRole('button', { name: d.sendMail }).click()
  await expect(page.getByRole('alert')).toHaveText(d.emailInvalid)

  await page.getByLabel(d.emailLabel).fill('imprenta@ejemplo.com')
  const [mail] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: d.sendMail }).click()])
  expect(mail).toBeTruthy()

  await page.getByRole('button', { name: send.whatsappButton }).click()
  await expect(page.getByRole('alert')).toHaveText(wa.empty)
  await page.getByLabel(wa.label).fill('011 15 2345-6789')
  const [chat] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: send.whatsappButton }).click()])
  expect(chat).toBeTruthy()

  const requests = guard.externalRequests()
  expect(requests.some((u) => u.startsWith('https://mail.google.com/mail/?view=cm&fs=1&to=imprenta%40ejemplo.com'))).toBe(true)
  expect(requests).toContain(`https://web.whatsapp.com/send?phone=5491123456789&text=${encodeURIComponent(wa.message)}`)
  expect(downloads).toBe(2)
  await expect(page.getByText(send.attachHint)).toBeVisible()
})

test('sin Web Share, «Usar mi programa de correo» descarga el PDF y muestra la indicación', async ({ page }) => {
  await page.goto('./')
  await toPrint(page)
  const button = page.getByRole('button', { name: d.useMailProgram })
  await expect(button).toBeEnabled()
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()])
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  await expect(page.getByText(send.attachHint)).toBeVisible()
})

test('con Web Share, mandar abre el enlace sin descargar ni indicación', async ({ page }) => {
  await fakeShare(page)
  let downloads = 0
  page.on('download', () => downloads++)
  await page.goto('./')
  await toPrint(page)
  await page.getByText(output.options.send.title).click()
  await page.getByLabel(wa.label).fill('011 15 2345-6789')
  const [chat] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: send.whatsappButton }).click()])
  expect(chat).toBeTruthy()
  expect(downloads).toBe(0)
  await expect(page.getByText(send.attachHint)).toHaveCount(0)
})

test('con Web Share en escritorio aparece Compartir, Imprimir sigue resaltada y Mandar queda cerrada', async ({ page }) => {
  await fakeShare(page)
  await page.goto('./')
  await toPrint(page)
  await expect(card(page, output.options.share.title)).toBeVisible()
  await expect(card(page, output.options.share.title)).toHaveAttribute('data-highlighted', 'false')
  await expect(card(page, output.options.print.title)).toHaveAttribute('data-highlighted', 'true')
  await expect(page.getByRole('button', { name: d.sendMail })).toBeHidden()
  await page.getByText(output.options.send.title).click()
  await expect(page.getByRole('button', { name: d.sendMail })).toBeVisible()
})

test('Empezar de nuevo vacía el correo', async ({ page }) => {
  await page.goto('./')
  await toPrint(page)
  await page.getByLabel(d.emailLabel).fill('a@b.com')
  await savePdf(page)
  await page.getByRole('button', { name: output.restart, exact: true }).click()
  await toPrint(page)
  await expect(page.getByLabel(d.emailLabel)).toHaveValue('')
})
