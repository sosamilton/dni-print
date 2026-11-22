import { test, expect } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'

// Solo Chromium (ver playwright.config.ts): trae una cámara falsa y acepta el permiso.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
})

test('en escritorio "Sacar foto" abre la cámara y carga la captura', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: strings.loadStep.takePhoto }).first().click()
  const dialog = page.getByRole('dialog', { name: strings.camera.title })
  await expect(dialog).toBeVisible()
  const shoot = dialog.getByRole('button', { name: strings.camera.shoot, exact: true })
  await expect(shoot).toBeEnabled()
  await shoot.click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(strings.loadStep.loaded(strings.loadStep.faces.front))).toBeVisible()
})

test('en escritorio la cámara se ofrece aunque el navegador no liste dispositivos', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.enumerateDevices = () => Promise.resolve([])
  })
  await page.goto('./')
  await expect(page.getByRole('button', { name: strings.loadStep.takePhoto }).first()).toBeVisible()
})
