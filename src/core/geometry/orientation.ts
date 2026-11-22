// Initial rotation of a face (story 7.2): which of 0/90/180/270 leaves the document upright.
// Two steps: the AXIS from the quad's shape, then the SENSE from simple ink measures on a small gray crop.
// No template of any real document: only relative positions (text/barcode/MRZ weigh at the bottom of the face).
import type { DocumentProfile } from '../profiles.ts'
import { validateQuad } from './quad.ts'
import { rectify } from './rectify.ts'
import type { PixelImage, Point, Quad, Rotation } from './types.ts'

/** The long side is the card's width only when it beats the short one by this ratio; otherwise the axis is unclear. */
export const AXIS_RATIO_MARGIN = 1.12
/** Minimum |score| to trust the sense; below it the face keeps the rotation the axis gives. */
export const SENSE_MIN_SCORE = 0.15
/** Width of the gray crop the sense is measured on. */
export const ORIENTATION_CROP_WIDTH_PX = 160

/** Rotation for a portrait quad whose sense is unknown (the other axis is 0). */
const VERTICAL_DEFAULT: Rotation = 270

export type OrientationSource = 'axis' | 'content'

export interface OrientationResult {
  rotation: Rotation
  /** 'content' when the sense was clear; 'axis' when only the shape decided (the user can still tap Rotar). */
  decidedBy: OrientationSource
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Axis from the quad's shape: 'horizontal' (rotation 0/180), 'vertical' (90/270) or null when near-square. */
export function quadAxis(quad: Quad): 'horizontal' | 'vertical' | null {
  const across = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2
  const down = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2
  if (!(across > 0) || !(down > 0)) return null
  if (across >= down * AXIS_RATIO_MARGIN) return 'horizontal'
  if (down >= across * AXIS_RATIO_MARGIN) return 'vertical'
  return null
}

function toGray(img: PixelImage): Float32Array {
  const gray = new Float32Array(img.width * img.height)
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4
    gray[i] = 0.299 * img.data[o]! + 0.587 * img.data[o + 1]! + 0.114 * img.data[o + 2]!
  }
  return gray
}

/**
 * Positive when the bottom of the face carries more ink than the top (both faces of an ID card do: the number and
 * barcode on the front, the machine-readable lines on the back). Ink = contrast against a 5×5 local mean, normalized
 * by that mean so a shadow across the face does not count as ink. Range about -1..1; ~0 for a blank or flat face.
 */
export function bottomHeaviness(img: PixelImage): number {
  const { width: w, height: h } = img
  if (w < 8 || h < 8 || !(img.data.length >= w * h * 4)) return 0
  const gray = toGray(img)
  const band = Math.max(1, Math.floor(h * 0.3))
  let top = 0
  let bottom = 0
  for (let y = 0; y < h; y++) {
    const inTop = y < band
    const inBottom = y >= h - band
    if (!inTop && !inBottom) continue
    const y0 = Math.max(0, y - 2)
    const y1 = Math.min(h - 1, y + 2)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 2)
      const x1 = Math.min(w - 1, x + 2)
      let sum = 0
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) sum += gray[yy * w + xx]!
      const mean = sum / ((y1 - y0 + 1) * (x1 - x0 + 1))
      const ink = Math.abs(gray[y * w + x]! - mean) / (mean + 20)
      if (inTop) top += ink
      else bottom += ink
    }
  }
  const total = top + bottom
  return total > 0 ? (bottom - top) / total : 0
}

/**
 * Rotation that leaves the face upright for `quad` (TL, TR, BR, BL in `image` px). Pure; never throws.
 * Near-square quads and unclear content fall back to what the shape gives (0, or 270 for a portrait quad).
 */
export function chooseRotation(image: PixelImage, quad: Quad, profile: DocumentProfile): OrientationResult {
  try {
    if (!validateQuad(quad)) return { rotation: 0, decidedBy: 'axis' }
    const axis = quadAxis(quad)
    if (axis === null) return { rotation: 0, decidedBy: 'axis' }
    const base: Rotation = axis === 'horizontal' ? 0 : VERTICAL_DEFAULT
    const turned: Rotation = axis === 'horizontal' ? 180 : 90
    return decide(image, quad, profile, base, turned)
  } catch {
    return { rotation: 0, decidedBy: 'axis' }
  }
}

function decide(image: PixelImage, quad: Quad, profile: DocumentProfile, base: Rotation, turned: Rotation): OrientationResult {
  // rectify() outputs at 300 DPI; shrink the profile so the crop is ORIENTATION_CROP_WIDTH_PX wide.
  const factor = ORIENTATION_CROP_WIDTH_PX / ((profile.widthMm / 25.4) * 300)
  const crop = rectify(image, quad, base, { ...profile, widthMm: profile.widthMm * factor, heightMm: profile.heightMm * factor })
  if (!crop) return { rotation: base, decidedBy: 'axis' }
  const score = bottomHeaviness(crop)
  if (score >= SENSE_MIN_SCORE) return { rotation: base, decidedBy: 'content' }
  if (score <= -SENSE_MIN_SCORE) return { rotation: turned, decidedBy: 'content' }
  return { rotation: base, decidedBy: 'axis' }
}
