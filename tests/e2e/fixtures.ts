import { deflateSync } from 'node:zlib'

function crc32(buf: Buffer): number {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** Encodes 8-bit RGB rows (`rgb.length === widthPx * heightPx * 3`) as a PNG. */
function encodeRgbPng(widthPx: number, heightPx: number, rgb: Uint8Array): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(widthPx, 0)
  header.writeUInt32BE(heightPx, 4)
  header[8] = 8
  header[9] = 2
  const raw = Buffer.alloc(heightPx * (widthPx * 3 + 1))
  for (let y = 0; y < heightPx; y++) {
    const o = y * (widthPx * 3 + 1)
    raw[o] = 0
    raw.set(rgb.subarray(y * widthPx * 3, (y + 1) * widthPx * 3), o + 1)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Synthetic solid-color RGB PNG, generated in code (never a real photo). */
export function syntheticPng(widthPx = 120, heightPx = 80, rgb: [number, number, number] = [60, 120, 200]): Buffer {
  const data = new Uint8Array(widthPx * heightPx * 3)
  for (let i = 0; i < data.length; i += 3) data.set(rgb, i)
  return encodeRgbPng(widthPx, heightPx, data)
}

/** Separable box blur on a gray plane, `passes` times. */
function boxBlur(gray: Float64Array<ArrayBuffer>, w: number, h: number, radius: number, passes: number): Float64Array<ArrayBuffer> {
  let src = gray
  for (let p = 0; p < passes; p++) {
    for (const horizontal of [true, false]) {
      const out = new Float64Array(src.length)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0
          let n = 0
          for (let t = -radius; t <= radius; t++) {
            const xx = horizontal ? x + t : x
            const yy = horizontal ? y : y + t
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
            sum += src[yy * w + xx]!
            n++
          }
          out[y * w + x] = sum / n
        }
      }
      src = out
    }
  }
  return src
}

/**
 * Synthetic document-like scene with simulated text (rows of dark bars on a light background) over the
 * whole frame, sized so the default crop rectifies about 1:1. `blurred` applies a strong box blur.
 */
export function textScenePng(blurred = false, widthPx = 1260, heightPx = 800): Buffer {
  let gray = new Float64Array(widthPx * heightPx)
  for (let y = 0; y < heightPx; y++) {
    for (let x = 0; x < widthPx; x++) {
      const line = Math.floor(y / 18)
      const inLine = y % 18 < 9
      const letter = Math.floor(x / 5)
      gray[y * widthPx + x] = inLine && (letter * 7 + line * 3) % 5 < 3 ? 25 : 225
    }
  }
  if (blurred) gray = boxBlur(gray, widthPx, heightPx, 6, 3)
  const rgb = new Uint8Array(widthPx * heightPx * 3)
  for (let i = 0; i < gray.length; i++) rgb.fill(Math.round(gray[i]!), i * 3, i * 3 + 3)
  return encodeRgbPng(widthPx, heightPx, rgb)
}

export const sharpSceneFile = (name = 'nitida.png') => ({ name, mimeType: 'image/png', buffer: textScenePng(false) })
export const blurredSceneFile = (name = 'borrosa.png') => ({ name, mimeType: 'image/png', buffer: textScenePng(true) })

export const pngFile = (name = 'foto.png') => ({ name, mimeType: 'image/png', buffer: syntheticPng() })
export const textFile = () => ({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') })
