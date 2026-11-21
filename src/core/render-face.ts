// Face rendering (AD-10): turns a rectified face into the final bitmap.
// Epic 2 only supports color mode with no watermark; filters and watermark come later.
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

export type FaceFilter = 'color'

/** Renders a rectified face. Returns null for an unsupported filter or watermark. */
export async function renderFace(
  rectified: PixelImage,
  filter: FaceFilter,
  watermark: null,
  raster: RasterBackend,
): Promise<BitmapLike | null> {
  if (filter !== 'color' || watermark !== null) return null
  return raster.createBitmap(rectified)
}
