import { test as base, expect, type Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { expectedCsp } from '../csp-policy.ts'
import { pngFile } from './fixtures.ts'
import { installNetworkGuard, type NetworkGuard } from './network-guard.ts'

const test = base.extend<{ guard: NetworkGuard }>({
  guard: async ({ context, baseURL }, provide) => {
    if (!baseURL) throw new Error('Falta baseURL en playwright.config.ts')
    await provide(await installNetworkGuard(context, new URL(baseURL).origin))
  },
})

async function expectTitle(page: Page, title: string) {
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

async function loadBothFaces(page: Page) {
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await expect(page.getByRole('button', { name: strings.steps.load.primary, exact: true })).toBeEnabled()
}

async function clickPrimary(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click()
}

/** Visits every screen: the 4 steps, "Atrás", the ⋮ menu and the privacy dialog. */
async function walkThroughApp(page: Page) {
  const { steps, wizard, menu, privacyDialog } = strings

  await page.goto('./')
  await expectTitle(page, steps.load.title)

  await loadBothFaces(page)
  await clickPrimary(page, steps.load.primary)
  await expectTitle(page, steps.crop.title)
  await page.getByRole('button', { name: wizard.back, exact: true }).click()
  await expectTitle(page, steps.load.title)

  await clickPrimary(page, steps.load.primary)
  await expectTitle(page, steps.crop.title)
  await clickPrimary(page, steps.crop.primary)
  await clickPrimary(page, steps.crop.primary)
  await expectTitle(page, steps.print.title)
  await clickPrimary(page, steps.print.primary)
  await expectTitle(page, steps.done.title)

  // WhatsApp panel: showing the field and typing a number makes no requests. Submitting opens
  // wa.me in a new tab by the user's decision (a navigation, not an app request); that is
  // covered in whatsapp.spec.ts.
  await page.getByRole('button', { name: strings.doneStep.whatsapp.toggle }).click()
  await page.getByLabel(strings.doneStep.whatsapp.label).fill('11 2345 6789')

  // Menu: open the privacy dialog; "Código fuente" is only checked, never followed (it leaves the origin).
  await page.getByRole('button', { name: menu.buttonLabel }).click()
  await expect(page.getByText(menu.sourceCode, { exact: false }).first()).toBeVisible()
  await page.getByRole('button', { name: menu.privacy, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: privacyDialog.title })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: menu.close, exact: true }).click()
  await expect(dialog).toBeHidden()

  await clickPrimary(page, steps.done.primary)
  await expectTitle(page, steps.load.title)

  await page.waitForLoadState('networkidle')
}

test.describe('guardia de red (CSP desactivada para ver todo intento)', () => {
  test.use({ bypassCSP: true })

  test('recorre la app sin requests a otros orígenes', async ({ page, guard }) => {
    await walkThroughApp(page)
    expect(guard.externalRequests(), 'Requests a otros orígenes').toEqual([])
    expect(guard.failedResponses(), 'Respuestas con error del propio origen').toEqual([])
  })

  test('cordura: detecta y aborta un fetch externo desde la página', async ({ page, guard }) => {
    await page.goto('./')
    await expectTitle(page, strings.steps.load.title)
    const outcome = await page.evaluate(() =>
      fetch('https://example.com/').then(
        () => 'respondió',
        () => 'abortado',
      ),
    )
    expect(outcome).toBe('abortado')
    expect(guard.externalRequests()).toContain('https://example.com/')
  })

  test('cordura: detecta un fetch externo desde un worker', async ({ page, guard, browserName }) => {
    // Límite conocido, aceptado en la historia 1.4: en WebKit la guardia no ve el tráfico de
    // workers (el fetch queda colgado sin resolverse ni fallar). Se cubre en Chromium y Firefox.
    test.skip(browserName === 'webkit', 'Playwright/WebKit no entrega el tráfico de workers a la guardia')
    await page.goto('./')
    await expectTitle(page, strings.steps.load.title)
    // A string keeps DOM-only APIs (Worker, Blob) out of the Node type context.
    const outcome = await page.evaluate(`new Promise((resolve) => {
      const source = "fetch('https://example.com/from-worker').then(() => postMessage('ok'), () => postMessage('error'))"
      const worker = new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })))
      worker.onmessage = (event) => resolve(event.data)
    })`)
    expect(outcome).toBe('error')
    await expect.poll(() => guard.externalRequests()).toContain('https://example.com/from-worker')
  })

  test('cordura: detecta un WebSocket externo', async ({ page, guard }) => {
    await page.goto('./')
    await expectTitle(page, strings.steps.load.title)
    await page.evaluate(`void new WebSocket('wss://example.com/')`)
    await expect.poll(() => guard.externalRequests()).toContain('wss://example.com/')
  })
})

test('cordura: detecta una respuesta 404 del propio origen', async ({ page, guard }) => {
  await page.goto('./')
  await expectTitle(page, strings.steps.load.title)
  await page.evaluate(`fetch('./no-existe.js').catch(() => null)`)
  await expect.poll(() => guard.failedResponses()).toContainEqual(expect.stringMatching(/^404 /))
})

const RECORD_CSP_VIOLATIONS = `window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', (event) => {
    window.__cspViolations.push(event.violatedDirective + ' ' + event.blockedURI);
  });`

test.describe('CSP activa', () => {
  test('sirve la CSP esperada (AD-7) y el recorrido no produce violaciones', async ({ page, guard }) => {
    await page.addInitScript({ content: RECORD_CSP_VIOLATIONS })

    await walkThroughApp(page)

    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toBe(expectedCsp())
    const violations = await page.evaluate('window.__cspViolations')
    expect(violations, 'Violaciones de CSP').toEqual([])
    expect(guard.externalRequests(), 'Requests a otros orígenes').toEqual([])
    expect(guard.failedResponses(), 'Respuestas con error del propio origen').toEqual([])
  })

  test('cordura: registra la violación de un fetch externo', async ({ page }) => {
    await page.addInitScript({ content: RECORD_CSP_VIOLATIONS })
    await page.goto('./')
    await expectTitle(page, strings.steps.load.title)
    await page.evaluate(`fetch('https://example.com/').catch(() => null)`)
    await expect.poll(() => page.evaluate('window.__cspViolations.length')).toBeGreaterThan(0)
  })
})
