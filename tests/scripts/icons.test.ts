import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { AZUL_DNI, CELESTE, FONDO_OSCURO, SOL, ZONA_SEGURA, faviconSvg, marca } from '../../scripts/make-icons.ts'

const publicDir = join(import.meta.dirname, '..', '..', 'public')

interface Rgba { width: number; height: number; data: Uint8Array }

/** Decodifica un PNG RGBA/RGB de 8 bits sin entrelazado (lo que genera Chromium). */
function decodePng(file: string): Rgba {
  const buf = readFileSync(join(publicDir, file))
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const channels = buf[25] === 6 ? 4 : 3
  expect([buf[24], buf[25], buf[28]], `${file}: formato`).toSatisfy(([depth, type, interlace]: number[]) => depth === 8 && (type === 6 || type === 2) && interlace === 0)
  const parts: Buffer[] = []
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at)
    if (buf.toString('latin1', at + 4, at + 8) === 'IDAT') parts.push(buf.subarray(at + 8, at + 8 + len))
    at += 12 + len
  }
  const raw = inflateSync(Buffer.concat(parts))
  const stride = width * channels
  const data = new Uint8Array(width * height * 4)
  let prev = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0
      const b = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      line[i] = (line[i] + [0, a, b, (a + b) >> 1, paeth][filter]) & 255
    }
    for (let x = 0; x < width; x++) {
      for (let k = 0; k < 3; k++) data[(y * width + x) * 4 + k] = line[x * channels + k]
      data[(y * width + x) * 4 + 3] = channels === 4 ? line[x * channels + 3] : 255
    }
    prev = line
  }
  return { width, height, data }
}

const px = (img: Rgba, x: number, y: number) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)]

/** Caja de los píxeles que no son el fondo del rincón (0,0) ni transparentes. */
function contentBox(img: Rgba, isBackground: (p: number[]) => boolean) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (isBackground(px(img, x, y))) continue
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
    }
  }
  return { x0, y0, x1, y1 }
}

const hex = (value: string) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16))
const close = (a: number[], b: number[], tol = 24) => b.every((v, i) => Math.abs(a[i] - v) <= tol)

describe('íconos de la marca', () => {
  it.each([
    ['favicon-32.png', 32],
    ['apple-touch-icon.png', 180],
    ['pwa-192.png', 192],
    ['pwa-512.png', 512],
    ['pwa-maskable-512.png', 512],
  ])('%s mide %i px', (file, size) => {
    const img = decodePng(file)
    expect([img.width, img.height]).toEqual([size, size])
  })

  it.each(['apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png'])(
    '%s deja la marca dentro del 80 %% central',
    (file) => {
      const img = decodePng(file)
      const bg = hex(FONDO_OSCURO)
      const box = contentBox(img, (p) => p[3] < 255 || close(p, bg, 6))
      const margen = (img.width * (1 - ZONA_SEGURA)) / 2
      expect(box.x0).toBeGreaterThanOrEqual(margen - 1)
      expect(box.y0).toBeGreaterThanOrEqual(margen - 1)
      expect(box.x1).toBeLessThanOrEqual(img.width - margen)
      expect(box.y1).toBeLessThanOrEqual(img.height - margen)
    },
  )

  it('el maskable llena todo el cuadrado con el fondo (sin esquinas redondeadas)', () => {
    const img = decodePng('pwa-maskable-512.png')
    for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) expect(close(px(img, x, y), hex(FONDO_OSCURO), 2)).toBe(true)
  })

  it('los no maskable tienen las esquinas redondeadas y el apple-touch-icon es cuadrado', () => {
    expect(px(decodePng('pwa-512.png'), 0, 0)[3]).toBeLessThan(16)
    expect(px(decodePng('pwa-192.png'), 0, 0)[3]).toBeLessThan(16)
    expect(px(decodePng('apple-touch-icon.png'), 0, 0)[3]).toBe(255)
  })

  it('a 16 px se leen las cuatro esquinas, la tarjeta celeste y el sol', () => {
    const src = decodePng('favicon-32.png')
    // Reducción 2×2 a 16 px, como hace el navegador en la pestaña.
    const small: Rgba = { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) for (let k = 0; k < 4; k++) {
      let sum = 0
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) sum += px(src, x * 2 + dx, y * 2 + dy)[k]
      small.data[(y * 16 + x) * 4 + k] = sum / 4
    }
    const opaque = (x0: number, y0: number, x1: number, y1: number) => {
      let best = 0
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) best = Math.max(best, px(small, x, y)[3])
      return best
    }
    for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) expect(opaque(x, y, x + 8, y + 8), `esquina ${x},${y}`).toBeGreaterThan(160)
    const colores = Array.from({ length: 16 * 16 }, (_, i) => [...small.data.subarray(i * 4, i * 4 + 4)])
    expect(colores.some((p) => p[3] > 200 && close(p, hex(CELESTE), 30))).toBe(true)
    expect(colores.some((p) => p[3] > 200 && close(p, hex(SOL), 45))).toBe(true)
    expect(colores.some((p) => p[3] > 200 && close(p, hex(AZUL_DNI), 60))).toBe(true)
  })
})

describe('favicon.svg', () => {
  it('es la marca de identity.md sin fondo y con esquinas claras en modo oscuro', () => {
    const svg = readFileSync(join(publicDir, 'favicon.svg'), 'utf8')
    expect(svg).toBe(faviconSvg())
    expect(svg).toContain('viewBox="0 0 64 64"')
    expect(svg).toContain('M6 18V9a3 3 0 013-3h9')
    expect(svg).toContain('prefers-color-scheme:dark')
    expect(svg).not.toMatch(/<rect width=/)
    expect(marca('#000')).toContain('<circle cx="24.5" cy="32" r="4.2"')
  })
})
