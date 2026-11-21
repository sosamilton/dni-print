import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { strings } from '../../src/ui/strings.es.ts'
import { pngFile } from './fixtures.ts'

const { steps, printStep, doneStep, menu } = strings

async function toPrint(page: import('@playwright/test').Page) {
  await page.goto('./')
  await page.getByTestId('front-gallery').setInputFiles(pngFile())
  await page.getByTestId('back-gallery').setInputFiles(pngFile())
  await page.getByRole('button', { name: steps.load.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
  await page.getByRole('button', { name: steps.crop.primary, exact: true }).click()
}

test('cargar, esquinas, 2 copias, PDF con 4 imágenes, Listo y borrar', async ({ page }) => {
  await toPrint(page)
  await expect(page.getByRole('button', { name: printStep.copies[2] })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('placement')).toHaveCount(4)
  await page.getByRole('button', { name: printStep.copies[1] }).click()
  await expect(page.getByTestId('placement')).toHaveCount(2)
  await page.getByRole('button', { name: printStep.copies[2] }).click()
  await expect(page.getByText(printStep.notice)).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: steps.print.primary, exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toBe('dni-print-2-copias.pdf')
  const pdf = readFileSync((await download.path())!).toString('latin1')
  expect(pdf.match(/\/I\d+ Do/g)).toHaveLength(4)
  await expect(page.getByRole('heading', { level: 1, name: steps.done.title })).toBeVisible()
  await page.getByRole('button', { name: steps.done.primary, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.load.title })).toBeVisible()
  await expect(page.getByText(doneStep.cleared)).toBeVisible()
  await expect(page.getByRole('button', { name: steps.load.primary, exact: true })).toBeDisabled()
})

test('Empezar de nuevo desde el menú', async ({ page }) => {
  await toPrint(page)
  await page.getByRole('button', { name: strings.menu.buttonLabel }).click()
  await page.getByRole('button', { name: menu.restart }).click()
  await expect(page.getByRole('heading', { level: 1, name: steps.load.title })).toBeVisible()
  await expect(page.getByText(doneStep.cleared)).toBeVisible()
})

test('Blanco y negro y Ahorro de tinta generan PDF en escala de grises', async ({ page }) => {
  await toPrint(page)
  await expect(page.getByRole('button', { name: printStep.filters.color })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: printStep.filters.ahorro }).click()
  await expect(page.getByRole('button', { name: printStep.filters.ahorro })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: printStep.filters.bn }).click()
  await expect(page.getByTestId('placement').first().locator('canvas')).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: steps.print.primary, exact: true }).click(),
  ])
  const pdf = readFileSync((await download.path())!).toString('latin1')
  expect(pdf).toMatch(/\/ColorSpace\s*\/DeviceGray/)
  expect(pdf).not.toMatch(/\/ColorSpace\s*\/DeviceRGB/)
})
