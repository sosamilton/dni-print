// Real imaging backend (AD-16): createImageBitmap + OffscreenCanvas, worker-only.
import type { PixelImage } from '../core/index.ts'
import type { ImagingBackend } from './processing-api.ts'

function context2d(width: number, height: number): OffscreenCanvasRenderingContext2D {
  const ctx = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D context unavailable')
  return ctx
}

export function createImagingBackend(): ImagingBackend {
  return {
    async decode(blob) {
      try {
        return await createImageBitmap(blob, { imageOrientation: 'from-image' })
      } catch {
        return null
      }
    },
    async scaleTo(bitmap, maxSidePx) {
      const k = Math.min(1, maxSidePx / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * k))
      const height = Math.max(1, Math.round(bitmap.height * k))
      const ctx = context2d(width, height)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bitmap as ImageBitmap, 0, 0, width, height)
      return createImageBitmap(ctx.canvas)
    },
    readPixels(bitmap) {
      const ctx = context2d(bitmap.width, bitmap.height)
      ctx.drawImage(bitmap as ImageBitmap, 0, 0)
      const { width, height, data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
      return { width, height, data } satisfies PixelImage
    },
    async encodeJpeg(pixels, quality) {
      const ctx = context2d(pixels.width, pixels.height)
      ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0)
      const blob = await ctx.canvas.convertToBlob({ type: 'image/jpeg', quality })
      return new Uint8Array(await blob.arrayBuffer())
    },
    raster: {
      async createBitmap(pixels) {
        const ctx = context2d(pixels.width, pixels.height)
        ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0)
        return createImageBitmap(ctx.canvas)
      },
    },
  }
}
