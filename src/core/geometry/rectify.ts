import type { DocumentProfile } from '../profiles.ts'
import { applyHomography, solveHomography } from './homography.ts'
import { orientQuad, validateQuad } from './quad.ts'
import type { PixelImage, Point, Quad } from './types.ts'

export const OUTPUT_DPI = 300
const MAX_SCALE_WITHOUT_PREFILTER = 2

export function outputSizePx(profile: DocumentProfile): { widthPx: number; heightPx: number } {
  return {
    widthPx: Math.round((profile.widthMm / 25.4) * OUTPUT_DPI),
    heightPx: Math.round((profile.heightMm / 25.4) * OUTPUT_DPI),
  }
}

/** True for a well-formed RGBA image. Never throws. */
export function isValidImage(img: PixelImage): boolean {
  return (
    !!img &&
    Number.isInteger(img.width) &&
    Number.isInteger(img.height) &&
    img.width > 0 &&
    img.height > 0 &&
    img.data?.length === img.width * img.height * 4
  )
}

/** Box-average downscale by an integer factor. */
function boxReduce(img: PixelImage, factor: number): PixelImage {
  const width = Math.max(1, Math.floor(img.width / factor))
  const height = Math.max(1, Math.floor(img.height / factor))
  const data = new Uint8ClampedArray(width * height * 4)
  const area = factor * factor
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let dy = 0; dy < factor; dy++) {
        const row = ((y * factor + dy) * img.width + x * factor) * 4
        for (let dx = 0; dx < factor; dx++) {
          const i = row + dx * 4
          r += img.data[i]
          g += img.data[i + 1]
          b += img.data[i + 2]
          a += img.data[i + 3]
        }
      }
      const o = (y * width + x) * 4
      data[o] = r / area
      data[o + 1] = g / area
      data[o + 2] = b / area
      data[o + 3] = a / area
    }
  }
  return { width, height, data }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Straightens the quad region to the profile's physical size at 300 DPI. Null on invalid input. */
export function rectify(
  image: PixelImage,
  quad: Quad,
  rotation: number,
  profile: DocumentProfile,
): PixelImage | null {
  if (!isValidImage(image) || !validateQuad(quad)) return null
  const oriented = orientQuad(quad, rotation)
  if (!oriented) return null
  const { widthPx, heightPx } = outputSizePx(profile)

  const quadWidth = Math.max(dist(oriented[0], oriented[1]), dist(oriented[3], oriented[2]))
  const quadHeight = Math.max(dist(oriented[0], oriented[3]), dist(oriented[1], oriented[2]))
  const scale = Math.max(quadWidth / widthPx, quadHeight / heightPx)

  let src = image
  let srcQuad: Point[] = oriented
  if (scale > MAX_SCALE_WITHOUT_PREFILTER) {
    const factor = Math.min(Math.floor(scale), image.width, image.height)
    src = boxReduce(image, factor)
    // Scale by the real size ratio: boxReduce drops the remainder pixels.
    const kx = src.width / image.width
    const ky = src.height / image.height
    srcQuad = oriented.map((p) => ({ x: p.x * kx, y: p.y * ky }))
  }

  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: widthPx, y: 0 },
    { x: widthPx, y: heightPx },
    { x: 0, y: heightPx },
  ]
  const h = solveHomography(dstCorners, srcQuad)
  if (!h) return null

  const out = new Uint8ClampedArray(widthPx * heightPx * 4)
  const maxX = src.width - 1
  const maxY = src.height - 1
  const sd = src.data
  for (let y = 0; y < heightPx; y++) {
    for (let x = 0; x < widthPx; x++) {
      const p = applyHomography(h, x + 0.5, y + 0.5)
      // Pixel centers sit at +0.5.
      const fx = Math.min(maxX, Math.max(0, p.x - 0.5))
      const fy = Math.min(maxY, Math.max(0, p.y - 0.5))
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const x1 = Math.min(maxX, x0 + 1)
      const y1 = Math.min(maxY, y0 + 1)
      const tx = fx - x0
      const ty = fy - y0
      const i00 = (y0 * src.width + x0) * 4
      const i10 = (y0 * src.width + x1) * 4
      const i01 = (y1 * src.width + x0) * 4
      const i11 = (y1 * src.width + x1) * 4
      const o = (y * widthPx + x) * 4
      for (let c = 0; c < 4; c++) {
        const top = sd[i00 + c] * (1 - tx) + sd[i10 + c] * tx
        const bottom = sd[i01 + c] * (1 - tx) + sd[i11 + c] * tx
        out[o + c] = top * (1 - ty) + bottom * ty
      }
    }
  }
  return { width: widthPx, height: heightPx, data: out }
}
