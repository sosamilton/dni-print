import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { encodeGrayPng } from '../../src/core/gray-png.ts'

describe('encodeGrayPng', () => {
  it('ida y vuelta multi-bloque: firma, IHDR y píxeles idénticos', () => {
    const w = 300
    const h = 300 // 90 300 bytes > 65 535 → más de un bloque deflate
    const gray = new Uint8Array(w * h).map((_, i) => (i * 7) & 0xff)
    const png = encodeGrayPng(w, h, gray)
    expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const view = new DataView(png.buffer)
    expect(view.getUint32(16)).toBe(w)
    expect(view.getUint32(20)).toBe(h)
    expect(png[24]).toBe(8)
    expect(png[25]).toBe(0)
    let at = 8
    const idat: Uint8Array[] = []
    while (at < png.length) {
      const len = view.getUint32(at)
      const type = String.fromCharCode(...png.slice(at + 4, at + 8))
      if (type === 'IDAT') idat.push(png.slice(at + 8, at + 8 + len))
      at += 12 + len
    }
    const raw = inflateSync(Buffer.concat(idat)) // valida Adler-32
    expect(raw.length).toBe((w + 1) * h)
    for (let y = 0; y < h; y++) {
      expect(raw[y * (w + 1)]).toBe(0)
      expect([...raw.subarray(y * (w + 1) + 1, (y + 1) * (w + 1))]).toEqual([...gray.subarray(y * w, (y + 1) * w)])
    }
  })
})
