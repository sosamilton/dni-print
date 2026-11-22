import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { card, savePdf, toPrint } from './output.ts'

const { steps, printStep, output, menu, wizard } = strings
const o = output.options

test('cargar, esquinas, 2 copias, Guardar PDF con 4 imágenes, aviso, Hacer otra cosa y Empezar de nuevo', async ({ page }) => {
  await page.goto('./')
  await toPrint(page)
  await expect(page.locator('.wizard-progress-segment')).toHaveCount(3)
  await expect(page.getByRole('progressbar', { name: wizard.progressLabel })).toHaveAttribute('aria-valuenow', '3')
  await expect(page.getByRole('button', { name: steps.print.primary, exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: printStep.copies[2] })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('placement')).toHaveCount(4)
  await expect(page.getByTestId('cut-line')).toBeVisible()
  await expect(page.getByTestId('cut-line')).toContainText(printStep.cutLabel)
  await page.getByRole('button', { name: printStep.copies[1] }).click()
  await expect(page.getByTestId('placement')).toHaveCount(2)
  await expect(page.getByTestId('cut-line')).toHaveCount(0)
  await page.getByRole('button', { name: printStep.copies[2] }).click()
  await expect(page.getByText(printStep.notice)).toBeVisible()

  // Wide window with no Web Share: print, save, send; Imprimir highlighted.
  await expect(page.locator('.output-card')).toHaveCount(3)
  await expect(card(page, o.print.title)).toHaveAttribute('data-highlighted', 'true')
  await expect(card(page, o.print.title)).toHaveAccessibleDescription(o.print.help)
  await expect(card(page, o.save.title.pdf)).toHaveAttribute('data-highlighted', 'false')

  const download = await savePdf(page)
  expect(download.suggestedFilename()).toBe('dni-print-2-copias.pdf')
  const pdf = readFileSync((await download.path())!).toString('latin1')
  expect(pdf.match(/\/I\d+ Do/g)).toHaveLength(4)
  expect(pdf).toContain('Cortar aqu')
  await expect(page.getByText(output.after.saved)).toBeFocused()

  await page.getByRole('button', { name: output.another, exact: true }).click()
  await expect(card(page, o.print.title)).toBeFocused()
  await expect(page.getByText(output.after.saved)).toHaveCount(0)

  await savePdf(page)
  await page.getByRole('button', { name: output.restart, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.load.title })).toBeVisible()
  await expect(page.getByText(output.cleared)).toBeVisible()
  await expect(page.getByRole('button', { name: steps.load.primary, exact: true })).toBeDisabled()
})

test('Imprimir ahora crea un iframe blob, llama a print y avisa sin violaciones de CSP', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit se presenta como Safari macOS, que abre el PDF en una pestaña (test «Safari macOS»)')
  await page.addInitScript(() => {
    const w = window as unknown as { __prints: string[]; __cspViolations: string[] }
    w.__prints = []
    w.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (e) => w.__cspViolations.push(e.violatedDirective + ' ' + e.blockedURI))
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() {
        const frame = this as HTMLIFrameElement
        return { focus() {}, print() { w.__prints.push(frame.src) } }
      },
    })
  })
  await page.goto('./')
  await toPrint(page)
  const print = card(page, o.print.title)
  await expect(print).toBeEnabled()
  await print.click()
  await expect(page.getByText(output.after.printed)).toBeVisible()
  const prints = await page.evaluate('window.__prints')
  expect(prints).toHaveLength(1)
  expect((prints as string[])[0]).toMatch(/^blob:/)
  expect(await page.evaluate('window.__cspViolations')).toEqual([])
})

test.describe('Safari macOS', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15' })

  test('Imprimir abre el PDF en una pestaña nueva con la nota de Archivo › Imprimir', async ({ page }) => {
    await page.addInitScript(() => {
      window.open = () => ({}) as Window
    })
    await page.goto('./')
    await toPrint(page)
    await card(page, o.print.title).click()
    await expect(page.getByText(output.printOpened)).toBeVisible()
    await expect(page.getByText(output.after.printed)).toHaveCount(0)
  })
})

test('Empezar de nuevo desde el menú', async ({ page }) => {
  await page.goto('./')
  await toPrint(page)
  await page.getByRole('button', { name: strings.menu.buttonLabel }).click()
  await page.getByRole('button', { name: menu.restart }).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.load.title })).toBeVisible()
  await expect(page.getByText(output.cleared)).toBeVisible()
})

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Empezar de nuevo desde la hoja del menú', async ({ page }) => {
    await page.goto('./')
    await toPrint(page)
    await page.getByRole('button', { name: menu.buttonLabel }).click()
    const sheet = page.getByRole('dialog', { name: menu.sheetTitle })
    await sheet.getByRole('button', { name: menu.restart }).click()
    const title = page.getByRole('heading', { level: 1, name: steps.load.title })
    await expect(title).toBeVisible()
    await expect(page.getByText(output.cleared)).toBeVisible()
    await expect(sheet).toBeHidden()
    await expect(title).toBeFocused()
  })
})

test('Blanco y negro y Ahorro de tinta generan PDF en escala de grises', async ({ page }) => {
  await page.goto('./')
  await toPrint(page)
  await expect(page.getByRole('button', { name: printStep.filters.color })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: printStep.filters.ahorro }).click()
  await expect(page.getByRole('button', { name: printStep.filters.ahorro })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: printStep.filters.bn }).click()
  await expect(page.getByTestId('placement').first().locator('canvas')).toBeVisible()
  const download = await savePdf(page)
  const pdf = readFileSync((await download.path())!).toString('latin1')
  expect(pdf).toMatch(/\/ColorSpace\s*\/DeviceGray/)
  expect(pdf).not.toMatch(/\/ColorSpace\s*\/DeviceRGB/)
})
