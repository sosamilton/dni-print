// Blur measure for a rectified face: variance of the Laplacian on a fixed-width luma copy.
import { isValidImage } from './geometry/rectify.ts'
import type { PixelImage } from './geometry/types.ts'

/** Width of the reduced copy the sharpness is measured on; smaller images are never upscaled. */
export const SHARPNESS_WIDTH_PX = 512

/**
 * Below this a face is reported as blurry. Calibrated on 24 real photos of one document (faces
 * rectified with hand-marked corners): the 4 blurry ones measure 53–331 and the 20 sharp ones
 * 519–3797, so 400 sits in the gap. Backs measure lower than fronts, hence the margin on the sharp side.
 */
export const BLUR_THRESHOLD = 400

/** Rec. 601 luma of one RGB pixel (same formula as render-face). */
function luma(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b)
}

/**
 * Per output sample of an `n` → `m` area-average reduction: first source index and the integer weight
 * of each covered source sample (in 1/m px units; they add up to `n`, so a flat input stays exact).
 */
function areaWeights(n: number, m: number): { start: number; weights: number[] }[] {
  const out: { start: number; weights: number[] }[] = []
  for (let i = 0; i < m; i++) {
    const a = i * n
    const b = (i + 1) * n
    const start = Math.floor(a / m)
    const weights: number[] = []
    for (let j = start; j * m < b; j++) weights.push(Math.min(b, (j + 1) * m) - Math.max(a, j * m))
    out.push({ start, weights })
  }
  return out
}

/** Luma plane of `img` reduced by area averaging to at most SHARPNESS_WIDTH_PX wide. */
function reducedLuma(img: PixelImage): { width: number; height: number; data: Float64Array } {
  const { width: w, height: h, data: px } = img
  const full = new Float64Array(w * h)
  for (let i = 0; i < full.length; i++) full[i] = luma(px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!)
  if (w <= SHARPNESS_WIDTH_PX) return { width: w, height: h, data: full }

  const ow = SHARPNESS_WIDTH_PX
  const oh = Math.max(1, Math.round((h * ow) / w))
  const cols = areaWeights(w, ow)
  const rows = areaWeights(h, oh)
  const horizontal = new Float64Array(ow * h)
  for (let y = 0; y < h; y++) {
    const line = y * w
    for (let x = 0; x < ow; x++) {
      const { start, weights } = cols[x]!
      let sum = 0
      for (let j = 0; j < weights.length; j++) sum += full[line + start + j]! * weights[j]!
      horizontal[y * ow + x] = sum / w
    }
  }
  const out = new Float64Array(ow * oh)
  for (let y = 0; y < oh; y++) {
    const { start, weights } = rows[y]!
    for (let x = 0; x < ow; x++) {
      let sum = 0
      for (let j = 0; j < weights.length; j++) sum += horizontal[(start + j) * ow + x]! * weights[j]!
      out[y * ow + x] = sum / h
    }
  }
  return { width: ow, height: oh, data: out }
}

/**
 * Variance of the 4-neighbour Laplacian over the interior pixels of the reduced luma copy.
 * Higher is sharper; a single-color image gives 0. Null for an invalid image. Never throws or mutates.
 */
export function measureSharpness(image: PixelImage): number | null {
  try {
    if (!isValidImage(image)) return null
    const { width, height, data } = reducedLuma(image)
    if (width < 3 || height < 3) return 0
    let sum = 0
    let sumSq = 0
    let count = 0
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x
        const l = data[i - width]! + data[i + width]! + data[i - 1]! + data[i + 1]! - 4 * data[i]!
        sum += l
        sumSq += l * l
        count++
      }
    }
    const mean = sum / count
    return Math.max(0, sumSq / count - mean * mean)
  } catch {
    return null
  }
}

/** True only for a measured sharpness under BLUR_THRESHOLD; an unmeasured face is never blurry. */
export function isBlurry(sharpness: number | null): boolean {
  return sharpness !== null && sharpness < BLUR_THRESHOLD
}
