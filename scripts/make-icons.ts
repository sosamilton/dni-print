// Genera los íconos de la marca (identity.md) en public/: favicon.svg y los PNG.
// Reproducible: `npm run make:icons`. Rasteriza con Chromium de Playwright (devDependency); no suma dependencias de runtime.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

export const CELESTE = '#74ACDF'
export const SOL = '#F6B40E'
export const AZUL_DNI = '#2563A8'
export const FONDO_OSCURO = '#12202E'
/** Parte del lado que puede ocupar la marca (identity.md: «dentro del 80 % central»). */
export const ZONA_SEGURA = 0.8
/** Extensión real de la marca en el viewBox de 64 (trazo de 4 incluido): de 4 a 60. */
const EXTENSION_MARCA = 56 / 64

/** Geometría de identity.md, sin cambios; solo cambia el color de las esquinas. */
export function marca(esquinas: string): string {
  return `<g fill="none" stroke="${esquinas}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 18V9a3 3 0 013-3h9"/><path d="M46 6h9a3 3 0 013 3v9"/>
  <path d="M58 46v9a3 3 0 01-3 3h-9"/><path d="M18 58H9a3 3 0 01-3-3v-9"/>
</g>
<rect x="15" y="21" width="34" height="22" rx="3.5" fill="${CELESTE}"/>
<circle cx="24.5" cy="32" r="4.2" fill="${SOL}"/>
<rect x="31" y="27.5" width="13" height="2.8" rx="1.4" fill="#fff"/>
<rect x="31" y="33.5" width="9" height="2.8" rx="1.4" fill="#fff" opacity=".85"/>`
}

/** favicon.svg: marca sin fondo; las esquinas se aclaran en pestañas oscuras. */
export function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>.e{stroke:${AZUL_DNI}}@media (prefers-color-scheme:dark){.e{stroke:${CELESTE}}}</style>
${marca(AZUL_DNI).replace('stroke="' + AZUL_DNI + '"', 'class="e"')}
</svg>
`
}

/** SVG cuadrado de `lado` px con la marca centrada y dentro de la zona segura. */
export function iconSvg(lado: number, opts: { fondo: string | null; radio: number; esquinas: string }): string {
  const marcaPx = (lado * ZONA_SEGURA * 0.97) / EXTENSION_MARCA
  const off = (lado - marcaPx) / 2
  const fondo = opts.fondo ? `<rect width="${lado}" height="${lado}" rx="${opts.radio}" fill="${opts.fondo}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">${fondo}
<svg x="${off}" y="${off}" width="${marcaPx}" height="${marcaPx}" viewBox="0 0 64 64">${marca(opts.esquinas)}</svg></svg>`
}

const ICONOS = [
  // Pestaña: sin fondo, marca a todo el lado (no es un ícono de pantalla de inicio).
  { archivo: 'favicon-32.png', lado: 32, svg: () => faviconPlano(32) },
  { archivo: 'apple-touch-icon.png', lado: 180, svg: () => iconSvg(180, { fondo: FONDO_OSCURO, radio: 0, esquinas: CELESTE }) },
  { archivo: 'pwa-192.png', lado: 192, svg: () => iconSvg(192, { fondo: FONDO_OSCURO, radio: 192 * 0.2, esquinas: CELESTE }) },
  { archivo: 'pwa-512.png', lado: 512, svg: () => iconSvg(512, { fondo: FONDO_OSCURO, radio: 512 * 0.2, esquinas: CELESTE }) },
  { archivo: 'pwa-maskable-512.png', lado: 512, svg: () => iconSvg(512, { fondo: FONDO_OSCURO, radio: 0, esquinas: CELESTE }) },
]

function faviconPlano(lado: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 64 64">${marca(AZUL_DNI)}</svg>`
}

async function main(): Promise<void> {
  const out = join(import.meta.dirname, '..', 'public')
  writeFileSync(join(out, 'favicon.svg'), faviconSvg())
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 })
    for (const icono of ICONOS) {
      await page.setViewportSize({ width: icono.lado, height: icono.lado })
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${icono.svg()}`)
      const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: icono.lado, height: icono.lado } })
      writeFileSync(join(out, icono.archivo), png)
      console.log(`${icono.archivo} ${icono.lado}x${icono.lado}`)
    }
  } finally {
    await browser.close()
  }
}

if (process.argv[1] === import.meta.filename) await main()
