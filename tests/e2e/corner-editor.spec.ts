import { expect, test, type Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { cropStep, steps } = strings

async function openCrop(page: Page) {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
}

const ok = (page: Page) => page.getByRole('button', { name: steps.crop.primary, exact: true })

const left = (el: Element) => parseFloat(el.getAttribute('style')!.match(/left:\s*([\d.]+)/)![1])

test('una cara por vez: frente, dorso y luego paso 3', async ({ page }) => {
  await openCrop(page)
  await expect(page.getByText(cropStep.faceCounter('Frente', 1, 2))).toBeVisible()
  await expect(page.getByText(cropStep.notFound)).toBeVisible()
  await ok(page).click()
  await expect(page.getByText(cropStep.faceCounter('Dorso', 2, 2))).toBeVisible()
  await ok(page).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.print.title })).toBeVisible()
})

test('teclado: Tab, flechas y Shift+flechas mueven la esquina', async ({ page }) => {
  await openCrop(page)
  const tl = page.getByRole('button', { name: cropStep.corners[0] })
  await tl.focus()
  const x0 = await tl.evaluate(left)
  await page.keyboard.press('Shift+ArrowRight')
  const x1 = await tl.evaluate(left)
  expect(x1).toBeGreaterThan(x0)
  // Pulsaciones rápidas, sin esperar al worker: cada una parte del quad ya movido.
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(() => tl.evaluate(left)).toBeCloseTo(x1 + 4 * (x1 - x0), 1)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: cropStep.corners[1] })).toBeFocused()
})

test('cruzar esquinas muestra el error y bloquea; Restablecer lo arregla; poca resolución avisa', async ({ page }) => {
  await openCrop(page)
  // El PNG sintético mide 120 px de ancho: el aviso ámbar aparece.
  await expect(page.getByText(cropStep.lowResolution)).toBeVisible()
  const tl = page.getByRole('button', { name: cropStep.corners[0] })
  await tl.focus()
  // TL pasa más allá de TR en x (96 px de margen de 12 → 10 flechas grandes).
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowRight')
  await expect(page.getByText(cropStep.invalid)).toBeVisible()
  await expect(ok(page)).toBeDisabled()
  await page.getByRole('button', { name: cropStep.reset }).click()
  await expect(page.getByText(cropStep.invalid)).toHaveCount(0)
  await expect(ok(page)).toBeEnabled()
})

test('arrastrar una esquina con el mouse y girar', async ({ page }) => {
  await openCrop(page)
  const br = page.getByTestId('corner-2')
  const box = (await br.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  // Moverla en diagonal para que el lado hacia TR no quede alineado con la cruz.
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 5)
  const magnifier = page.getByRole('img', { name: cropStep.magnifierLabel })
  await expect(magnifier).toBeVisible()
  // 150 px CSS de contenido, nítida (buffer = 150 × devicePixelRatio), del lado opuesto a BR.
  const mbox = (await magnifier.boundingBox())!
  const brBox = (await br.boundingBox())!
  const trBox = (await page.getByTestId('corner-1').boundingBox())!
  // El aumento es uniforme: la dirección BR→TR en pantalla es la misma dentro de la lupa.
  const dir = { x: trBox.x - brBox.x, y: trBox.y - brBox.y }
  const canvas = await magnifier.evaluate((el: HTMLCanvasElement, d) => {
    const ctx = el.getContext('2d')!
    const scale = el.width / el.clientWidth
    // Lejos de la cruz y de los lados: tiene que verse la foto (PNG sólido 60,120,200).
    const at = Math.round(el.width * 0.25)
    const px = Array.from(ctx.getImageData(at, at, 1, 1).data)
    // Sobre el lado hacia TR, a 50 px CSS del centro: algo dibujado distinto de la foto.
    const len = Math.hypot(d.x, d.y)
    const sx = Math.round((75 + (50 * d.x) / len) * scale)
    const sy = Math.round((75 + (50 * d.y) / len) * scale)
    const area = ctx.getImageData(sx - 2, sy - 2, 5, 5).data
    let minBlue = 255
    for (let i = 0; i < area.length; i += 4) minBlue = Math.min(minBlue, area[i + 2])
    return { clientWidth: el.clientWidth, width: el.width, expected: Math.round(150 * window.devicePixelRatio), px, minBlue }
  }, dir)
  expect(canvas.clientWidth).toBe(150)
  expect(canvas.width).toBe(canvas.expected)
  const [r, g, b, alpha] = canvas.px
  expect(alpha).toBe(255)
  expect(b).toBeGreaterThan(r + 60)
  expect(b).toBeGreaterThan(g + 30)
  expect(canvas.minBlue).toBeLessThan(b - 15)
  await expect(magnifier).toHaveAttribute('data-side', 'left')
  await expect(magnifier).toHaveAttribute('data-vside', 'top')
  const stage = (await page.getByTestId('corner-editor').boundingBox())!
  expect(mbox.x + mbox.width).toBeLessThan(stage.x + stage.width / 2)
  await page.mouse.up()
  await expect(page.getByRole('img', { name: cropStep.magnifierLabel })).toHaveCount(0)
  await page.getByRole('button', { name: cropStep.rotate }).click()
  await expect(page.getByRole('img', { name: cropStep.resultLabel })).toBeVisible()
})

test('escritorio: fichas Frente y Dorso clicables con estado; las dos revisadas avanzan', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openCrop(page)
  const chips = page.getByRole('list', { name: cropStep.faceSelectorLabel })
  await page.getByRole('button', { name: /Dorso/ }).click()
  await expect(page.getByText(cropStep.faceCounter('Dorso', 2, 2))).toBeVisible()
  await ok(page).click()
  // Dorso revisada: pasa a la pendiente (Frente), todavía en el paso 2.
  await expect(page.getByText(cropStep.faceCounter('Frente', 1, 2))).toBeVisible()
  await expect(chips.getByText(cropStep.faceDone)).toHaveCount(1)
  // Editar una cara revisada la vuelve pendiente.
  await page.getByRole('button', { name: /Dorso/ }).click()
  await page.getByRole('button', { name: cropStep.corners[0] }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(chips.getByText(cropStep.faceDone)).toHaveCount(0)
  await ok(page).click()
  await ok(page).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.print.title })).toBeVisible()
})
