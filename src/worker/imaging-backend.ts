// Real imaging backend (AD-16): createImageBitmap + OffscreenCanvas, worker-only.
import type { PixelImage } from '../core/index.ts'
import type { ImagingBackend } from './processing-api.ts'

function context2d(width: number, height: number): OffscreenCanvasRenderingContext2D {
  const ctx = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D context unavailable')
  return ctx
}

const WATERMARK_FAMILY = 'Atkinson Hyperlegible Watermark'
let watermarkFont: Promise<void> | null = null

/** Registers the bundled Atkinson 700 inside the worker (no network beyond our own origin). */
function loadWatermarkFont(): Promise<void> {
  watermarkFont ??= (async () => {
    const url = `${import.meta.env.BASE_URL}fonts/atkinson-hyperlegible-latin-700-normal.woff2`
    const face = new FontFace(WATERMARK_FAMILY, `url(${url})`, { weight: '700' })
    await face.load()
    self.fonts.add(face)
  })().catch((error) => {
    watermarkFont = null
    throw error
  })
  return watermarkFont
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
      async drawWatermark(pixels, text) {
        // A failed font load falls back to the generic sans-serif in the font stack.
        await loadWatermarkFont().catch(() => {})
        const { width, height } = pixels
        const ctx = context2d(width, height)
        ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), width, height), 0, 0)
        // Diagonal, centered, sized so 40 chars still fit across the face; gray so bn/ahorro stay colorless.
        const size = Math.max(12, Math.round(Math.min(width, height) * 0.09))
        ctx.font = `700 ${size}px "${WATERMARK_FAMILY}", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const diagonal = Math.hypot(width, height)
        const measured = ctx.measureText(text).width
        if (measured > diagonal * 0.85) {
          ctx.font = `700 ${Math.max(8, Math.floor((size * diagonal * 0.85) / measured))}px "${WATERMARK_FAMILY}", sans-serif`
        }
        ctx.translate(width / 2, height / 2)
        ctx.rotate(-Math.atan2(height, width))
        ctx.fillStyle = 'rgba(128, 128, 128, 0.55)'
        ctx.fillText(text, 0, 0)
        const out = ctx.getImageData(0, 0, width, height)
        return { width, height, data: out.data } satisfies PixelImage
      },
    },
  }
}
