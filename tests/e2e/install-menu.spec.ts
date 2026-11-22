import { expect, test, type Page } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'

const { menu } = strings
const PHONE = { width: 390, height: 844 }

async function offerInstall(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __prompted: number }
    w.__prompted = 0
    const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        w.__prompted++
      },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    window.dispatchEvent(e)
  })
}

const prompted = (page: Page) => page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)

test('escritorio: ⋯ ofrece "Instalar la app" solo tras beforeinstallprompt y llama a prompt()', async ({ page }) => {
  await page.goto('./')
  const more = page.getByRole('button', { name: menu.buttonLabel })
  await expect(more).toHaveText(menu.desktopButton)
  await more.click()
  await expect(page.getByRole('button', { name: menu.install })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await offerInstall(page)
  await more.click()
  await page.getByRole('button', { name: menu.install }).click()
  await expect.poll(() => prompted(page)).toBe(1)
})

test('escritorio: la barra muestra Cómo funciona, Compartir la app, tema y ⋯ con Código fuente y Empezar de nuevo, sin Preferencias', async ({
  page,
}) => {
  await page.goto('./')
  const bar = page.locator('.app-menu-bar')
  await expect(bar.getByRole('button', { name: menu.bar.privacy, exact: true })).toBeVisible()
  await expect(bar.getByRole('button', { name: menu.bar.shareApp, exact: true })).toBeVisible()
  await expect(bar.getByRole('button', { name: menu.bar.theme, exact: true })).toBeVisible()
  await bar.getByRole('button', { name: menu.buttonLabel }).click()
  const list = bar.getByRole('list')
  await expect(list.getByText(menu.sourceCode)).toBeVisible()
  const restart = list.getByRole('button', { name: menu.restart })
  await expect(restart).toBeVisible()
  await expect(list.getByRole('listitem').last()).toContainText(menu.restart)
  await expect(page.getByText('Preferencias')).toHaveCount(0)
  // No bottom sheet on desktop.
  await expect(page.locator('dialog.menu-sheet')).toHaveCount(0)
})

test.describe('celular', () => {
  test.use({ viewport: PHONE })

  test('⋮ abre una hoja con los grupos en orden, sin Preferencias, y Empezar de nuevo último, en rojo y con nota', async ({
    page,
  }) => {
    await page.goto('./')
    await expect(page.locator('.app-menu-bar')).toHaveCount(0)
    await page.getByRole('button', { name: menu.buttonLabel }).click()
    const sheet = page.getByRole('dialog', { name: menu.sheetTitle })
    await expect(sheet).toBeVisible()
    await expect(page.getByText('Preferencias')).toHaveCount(0)

    const groups = sheet.locator('.menu-sheet-group')
    await expect(groups).toHaveCount(4)
    await expect(groups.nth(0).getByRole('group', { name: menu.theme.label })).toBeVisible()
    await expect(groups.nth(1)).toContainText(menu.shareApp)
    await expect(groups.nth(1)).not.toContainText(menu.install)
    await expect(groups.nth(2)).toContainText(menu.privacy)
    await expect(groups.nth(2)).toContainText(menu.sourceCode)
    const restart = groups.nth(3).getByRole('button', { name: menu.restart })
    await expect(restart).toContainText(menu.restartNote)
    const colors = await page.evaluate(() => {
      const button = document.querySelector('.menu-sheet-group:last-child .app-menu-danger')!
      const probe = document.createElement('div')
      probe.style.color = 'var(--color-danger)'
      document.body.append(probe)
      const expected = getComputedStyle(probe).color
      probe.remove()
      return { actual: getComputedStyle(button).color, expected }
    })
    expect(colors.actual).toBe(colors.expected)
  })

  test('"Instalar la app" aparece en la hoja tras beforeinstallprompt y llama a prompt()', async ({ page }) => {
    await page.goto('./')
    await offerInstall(page)
    await page.getByRole('button', { name: menu.buttonLabel }).click()
    const sheet = page.getByRole('dialog', { name: menu.sheetTitle })
    await expect(sheet.locator('.menu-sheet-group').nth(1)).toContainText(menu.install)
    await sheet.getByRole('button', { name: menu.install }).click()
    await expect(sheet).toBeHidden()
    await expect.poll(() => prompted(page)).toBe(1)
  })
})
