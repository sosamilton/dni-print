import { describe, expect, it } from 'vitest'
import { applyFilter, normalizeWatermark, renderFace, type BitmapLike } from '../../src/core/render-face.ts'

const img = { width: 2, height: 1, data: new Uint8ClampedArray(8) }
const raster = {
  createBitmap: async (p: { width: number; height: number }): Promise<BitmapLike> => ({
    width: p.width,
    height: p.height,
    close() {},
  }),
  drawWatermark: async (p: { width: number; height: number; data: Uint8ClampedArray }) => p,
}

describe('renderFace', () => {
  it('renders color without watermark', async () => {
    const out = await renderFace(img, 'color', null, raster)
    expect(out).toMatchObject({ width: 2, height: 1 })
  })
  it('returns null for unsupported options', async () => {
    expect(await renderFace(img, 'bw' as never, null, raster)).toBeNull()
    expect(await renderFace(img, 'color', {} as never, raster)).toBeNull()
  })

  it('normalizes the watermark', () => {
    expect(normalizeWatermark(false, 'x')).toBeNull()
    expect(normalizeWatermark(true, '   ')).toBeNull()
    expect(normalizeWatermark(true, 'a'.repeat(60))?.text).toHaveLength(40)
  })
  it('null watermark is identical to the plain filter output and never stamps', async () => {
    const src = { width: 2, height: 1, data: new Uint8ClampedArray([200, 40, 40, 255, 10, 20, 30, 255]) }
    for (const filter of ['color', 'bn', 'ahorro'] as const) {
      let seen: Uint8ClampedArray | null = null
      let stamped = 0
      const spy = {
        createBitmap: async (p: { width: number; height: number; data: Uint8ClampedArray }) => ((seen = p.data), { width: p.width, height: p.height, close() {} }),
        drawWatermark: async (p: never) => (stamped++, p),
      }
      await renderFace(src, filter, null, spy)
      expect(Array.from(seen!)).toEqual(Array.from(applyFilter(src, filter).data))
      expect(stamped).toBe(0)
    }
  })
  it('stamps after the filter, in gray', async () => {
    const order: string[] = []
    const colorful = { width: 1, height: 1, data: new Uint8ClampedArray([200, 40, 40, 255]) }
    const spy = {
      createBitmap: async (p: { width: number; height: number }) => ({ width: p.width, height: p.height, close() {} }),
      drawWatermark: async (p: { width: number; height: number; data: Uint8ClampedArray }, t: string) => {
        order.push(t, `${p.data[0]}/${p.data[1]}`)
        return p
      },
    }
    await renderFace(colorful, 'bn', { text: 'Copia' }, spy)
    expect(order[0]).toBe('Copia')
    const [r, g] = order[1]!.split('/')
    expect(r).toBe(g)
  })

  describe('filters', () => {
    const colorful = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([200, 40, 40, 255, 40, 200, 40, 255, 230, 225, 220, 255]),
    }
    const capture = async (filter: 'bn' | 'ahorro') => {
      let seen: { data: Uint8ClampedArray } | null = null
      const spy = { createBitmap: async (p: { width: number; height: number; data: Uint8ClampedArray }) => ((seen = p), { width: p.width, height: p.height, close() {} }) }
      await renderFace(colorful, filter, null, { ...spy, drawWatermark: async (p) => p })
      return seen!.data
    }

    it('bn and ahorro output has no colored pixels', async () => {
      for (const filter of ['bn', 'ahorro'] as const) {
        const d = await capture(filter)
        for (let i = 0; i < d.length; i += 4) {
          expect(d[i]).toBe(d[i + 1])
          expect(d[i]).toBe(d[i + 2])
          expect(d[i + 3]).toBe(255)
        }
      }
    })

    it('ahorro lightens backgrounds relative to bn, to pure white for light ones', async () => {
      const bn = await capture('bn')
      const ahorro = await capture('ahorro')
      for (let i = 0; i < bn.length; i += 4) expect(ahorro[i]!).toBeGreaterThanOrEqual(bn[i]!)
      expect(bn[8]).toBeLessThan(255)
      expect(ahorro[8]).toBe(255)
    })

    it('does not modify the input and color is passthrough', () => {
      const before = Array.from(colorful.data)
      applyFilter(colorful, 'bn')
      expect(Array.from(colorful.data)).toEqual(before)
      expect(applyFilter(colorful, 'color')).toBe(colorful)
    })
  })
})
