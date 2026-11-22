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
  await dialog.getByRole('button', { name: strings.camera.accept }).click()
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

test('el diálogo muestra la guía, repite la foto sin espejo y libera el stream al cerrar', async ({ page }) => {
  await page.addInitScript(() => {
    const tracks: MediaStreamTrack[] = []
    ;(window as unknown as { __tracks: MediaStreamTrack[] }).__tracks = tracks
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await orig(c)
      tracks.push(...s.getTracks())
      return s
    }
  })
  await page.goto('./')
  await page.getByRole('button', { name: strings.loadStep.takePhoto }).first().click()
  const dialog = page.getByRole('dialog', { name: strings.camera.title })
  await expect(dialog.getByText(strings.camera.guide)).toBeVisible()
  await expect(dialog.locator('.camera-dialog-video')).not.toHaveCSS('transform', /matrix\(-1/)
  await expect(dialog.getByRole('button', { name: strings.camera.shoot, exact: true })).toBeEnabled()
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('button', { name: strings.camera.accept })).toBeVisible()
  await dialog.getByRole('button', { name: strings.camera.retake }).click()
  await expect(dialog.getByRole('button', { name: strings.camera.shoot, exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: strings.camera.cancel }).click()
  await expect(dialog).toBeHidden()
  const live = await page.evaluate(() =>
    (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.filter((t) => t.readyState === 'live').length,
  )
  expect(live).toBe(0)
})

test('sin webcam se puede pegar una imagen con Ctrl+V en la primera cara vacía', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    c.getContext('2d')!.fillRect(0, 0, 64, 64)
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
    const dt = new DataTransfer()
    dt.items.add(new File([blob], 'p.png', { type: 'image/png' }))
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await expect(page.getByText(strings.loadStep.loaded(strings.loadStep.faces.front))).toBeVisible()
})
