// Face rendering (AD-10): turns a rectified face into the final bitmap.
// Filters live here; the watermark arrives in a later story.
import type { PixelImage } from './geometry/types.ts'

/** Minimal bitmap handle (ImageBitmap-compatible); `close` frees its memory. */
export interface BitmapLike {
  readonly width: number
  readonly height: number
  close(): void
}

/** Raster operations needed by `renderFace`; the worker injects an OffscreenCanvas one. */
export interface RasterBackend {
  createBitmap(pixels: PixelImage): Promise<BitmapLike>
}

export type FaceFilter = 'color' | 'bn' | 'ahorro'

export const FACE_FILTERS: readonly FaceFilter[] = ['color', 'bn', 'ahorro']

/** Luma level (0-255) at or above which `ahorro` prints pure white. */
export const AHORRO_WHITE_POINT = 190

/** Rec. 601 luma of one RGB pixel. */
function luma(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b)
}

/** One gray byte per pixel for `bn` and `ahorro` (`ahorro` also lightens backgrounds). */
export function grayPlane(pixels: PixelImage, filter: 'bn' | 'ahorro'): Uint8Array {
  const count = pixels.width * pixels.height
  const gray = new Uint8Array(count)
  const k = 255 / AHORRO_WHITE_POINT
  for (let i = 0; i < count; i++) {
    const y = luma(pixels.data[i * 4]!, pixels.data[i * 4 + 1]!, pixels.data[i * 4 + 2]!)
    gray[i] = filter === 'ahorro' ? Math.min(255, Math.round(y * k)) : y
  }
  return gray
}

/** Applies a filter to RGBA pixels, returning a new image (the input is never modified). */
export function applyFilter(pixels: PixelImage, filter: FaceFilter): PixelImage {
  if (filter === 'color') return pixels
  const gray = grayPlane(pixels, filter)
  const data = new Uint8ClampedArray(gray.length * 4)
  for (let i = 0; i < gray.length; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = gray[i]!
    data[i * 4 + 3] = 255
  }
  return { width: pixels.width, height: pixels.height, data }
}

/** Renders a rectified face. Returns null for an unsupported filter or watermark. */
export async function renderFace(
  rectified: PixelImage,
  filter: FaceFilter,
  watermark: null,
  raster: RasterBackend,
): Promise<BitmapLike | null> {
  if (!FACE_FILTERS.includes(filter) || watermark !== null) return null
  return raster.createBitmap(applyFilter(rectified, filter))
}
