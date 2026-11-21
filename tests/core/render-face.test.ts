import { describe, expect, it } from 'vitest'
import { renderFace, type BitmapLike } from '../../src/core/render-face.ts'

const img = { width: 2, height: 1, data: new Uint8ClampedArray(8) }
const raster = {
  createBitmap: async (p: { width: number; height: number }): Promise<BitmapLike> => ({
    width: p.width,
    height: p.height,
    close() {},
  }),
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
})
