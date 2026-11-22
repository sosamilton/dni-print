// Genera los íconos de la marca (identity.md) en public/: favicon.svg y los PNG.
// Reproducible: `npm run make:icons`. Rasteriza con Chromium de Playwright (devDependency); no suma dependencias de runtime.
import { readFileSync, writeFileSync } from 'node:fs'
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

/** Tope de peso de og-image.png (compartir-y-seo.md). */
export const OG_MAX_BYTES = 300 * 1024

/** Tarjeta ilustrada (nunca un DNI real): foto de silueta y renglones genéricos. */
function tarjetaIlustrada(x: number, y: number, rot: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
<rect width="340" height="214" rx="16" fill="#fff" stroke="#D5DCE2" stroke-width="2"/>
<rect x="0" y="0" width="340" height="40" rx="16" fill="${CELESTE}"/><rect x="0" y="24" width="340" height="16" fill="${CELESTE}"/>
<circle cx="34" cy="20" r="7" fill="${SOL}"/>
<rect x="24" y="64" width="90" height="116" rx="8" fill="#E3EAF0"/>
<circle cx="69" cy="104" r="20" fill="#B9C6D2"/><path d="M33 180c0-24 16-38 36-38s36 14 36 38z" fill="#B9C6D2"/>
<rect x="136" y="72" width="170" height="12" rx="6" fill="#C9D3DC"/><rect x="136" y="100" width="130" height="12" rx="6" fill="#DCE3E9"/>
<rect x="136" y="128" width="150" height="12" rx="6" fill="#DCE3E9"/><rect x="136" y="156" width="90" height="12" rx="6" fill="#DCE3E9"/>
</g>`
}

/** HTML de la vista previa del enlace: 1200 × 630, marca grande, wordmark, bajada y hoja A4 con dos tarjetas ilustradas. */
export function ogImageHtml(fuente: string): string {
  return `<style>@font-face{font-family:FG;font-weight:700;src:url(data:font/woff2;base64,${fuente})}
html,body{margin:0}body{width:1200px;height:630px;background:${FONDO_OSCURO};overflow:hidden;position:relative;font-family:FG,sans-serif}
.m{position:absolute;left:72px;top:92px}.w{position:absolute;left:72px;top:300px;font-size:92px;font-weight:700;color:#fff;line-height:1}
.w span{color:${CELESTE}}.b{position:absolute;left:72px;top:420px;font-size:44px;font-weight:700;color:${SOL};line-height:1.15}
.s{position:absolute;left:72px;top:500px;font-size:28px;color:#B9C6D2;font-family:sans-serif}</style>
<div class="m">${iconSvg(180, { fondo: null, radio: 0, esquinas: CELESTE })}</div>
<div class="w">DNI <span>Print</span></div><div class="b">Tu DNI, a tamaño real.</div><div class="s">Sin cuentas. Sin subir fotos.</div>
<svg style="position:absolute;left:660px;top:36px;overflow:visible" width="480" height="560" viewBox="0 0 480 560">
<rect x="0" y="0" width="480" height="560" rx="10" fill="#fff" transform="rotate(3 240 280)"/>
<g transform="rotate(3 240 280)">${tarjetaIlustrada(70, 90, 0)}${tarjetaIlustrada(70, 330, 0)}</g></svg>`
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
    const fuente = readFileSync(join(out, 'fonts', 'familjen-grotesk-latin-700-normal.woff2')).toString('base64')
    await page.setViewportSize({ width: 1200, height: 630 })
    await page.setContent(ogImageHtml(fuente))
    await page.evaluate(() => document.fonts.ready)
    const og = await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } })
    if (og.length > OG_MAX_BYTES) throw new Error(`og-image.png pesa ${og.length} B (máximo ${OG_MAX_BYTES})`)
    writeFileSync(join(out, 'og-image.png'), og)
    console.log(`og-image.png 1200x630 ${og.length} B`)
  } finally {
    await browser.close()
  }
}

if (process.argv[1] === import.meta.filename) await main()
