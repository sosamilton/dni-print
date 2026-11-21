import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'

const { menu } = strings

test('el menú ofrece "Instalar la app" solo tras beforeinstallprompt y llama a prompt()', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: menu.buttonLabel }).click()
  await expect(page.getByRole('button', { name: menu.install })).toHaveCount(0)
  await page.keyboard.press('Escape')

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
  await page.getByRole('button', { name: menu.buttonLabel }).click()
  await page.getByRole('button', { name: menu.install }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1)
})
