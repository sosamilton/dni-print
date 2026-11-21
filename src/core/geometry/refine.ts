// Full-resolution corner refinement: snaps each side of a detected quad to the strongest
// nearby straight edge and intersects consecutive sides. Pure and deterministic.
import { validateQuad } from './quad.ts'
import { isValidImage } from './rectify.ts'
import type { PixelImage, Point, Quad } from './types.ts'

/** Fraction of each side ignored at both ends, beyond rounded document corners. */
const END_SKIP = 0.12
/** Half-width of the search strip, as a fraction of the shortest side (with a floor in px). */
const STRIP_FRACTION = 0.03
const MIN_STRIP_PX = 4
/** Corners may move at most this many strip half-widths. */
const MAX_MOVE_STRIPS = 2
const MIN_SAMPLES = 20
const MAX_SAMPLES = 200
const SAMPLE_SPACING_PX = 3
/** Minimum |luma derivative| (per px) to accept an edge point. */
const MIN_GRADIENT = 10
const RANSAC_ITERATIONS = 120
const RANSAC_THRESHOLD_PX = 1.5
const MIN_INLIERS = 8
const MIN_INLIER_RATIO = 0.4
const RANSAC_SEED = 0x6d2b79f5

interface Line {
  /** A point on the line. */
  p: Point
  /** Unit direction. */
  d: Point
}

/** Mulberry32: small seeded PRNG so the refinement is reproducible. */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Bilinear luma at continuous coordinates (pixel centers at +0.5). Caller guarantees bounds. */
function lumaAt(img: PixelImage, x: number, y: number): number {
  const fx = x - 0.5
  const fy = y - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(img.width - 1, x0 + 1)
  const y1 = Math.min(img.height - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  const d = img.data
  const l = (px: number, py: number) => {
    const i = (py * img.width + px) * 4
    return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  }
  const top = l(x0, y0) * (1 - tx) + l(x1, y0) * tx
  const bottom = l(x0, y1) * (1 - tx) + l(x1, y1) * tx
  return top * (1 - ty) + bottom * ty
}

function inside(img: PixelImage, x: number, y: number): boolean {
  return x >= 0.5 && y >= 0.5 && x <= img.width - 0.5 && y <= img.height - 0.5
}

/** Edge points found across the strip of side a→b; also returns how many samples were taken. */
function edgePoints(img: PixelImage, a: Point, b: Point, halfStrip: number): { points: Point[]; samples: number } {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
  const n = { x: -t.y, y: t.x }
  const span = len * (1 - 2 * END_SKIP)
  const samples = Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Math.round(span / SAMPLE_SPACING_PX)))
  const k = Math.ceil(halfStrip)
  const profile = new Float64Array(2 * k + 1)
  const points: Point[] = []
  for (let s = 0; s < samples; s++) {
    const along = len * END_SKIP + (span * (s + 0.5)) / samples
    const cx = a.x + t.x * along
    const cy = a.y + t.y * along
    // The strip (with tangential neighbors) must lie fully inside the image.
    let ok = true
    for (const o of [-k, k]) {
      for (const dt of [-1, 1]) {
        if (!inside(img, cx + n.x * o + t.x * dt, cy + n.y * o + t.y * dt)) ok = false
      }
    }
    if (!ok) continue
    for (let o = -k; o <= k; o++) {
      let sum = 0
      for (let dt = -1; dt <= 1; dt++) {
        sum += lumaAt(img, cx + n.x * o + t.x * dt, cy + n.y * o + t.y * dt)
      }
      profile[o + k] = sum / 3
    }
    let best = -1
    let bestG = MIN_GRADIENT
    const grad = (i: number) => Math.abs(profile[i + 1] - profile[i - 1]) / 2
    for (let i = 1; i < 2 * k; i++) {
      const g = grad(i)
      if (g > bestG) {
        bestG = g
        best = i
      }
    }
    if (best < 0) continue
    let offset = best - k
    if (best > 1 && best < 2 * k - 1) {
      const gm = grad(best - 1)
      const gp = grad(best + 1)
      const denom = gm - 2 * bestG + gp
      if (denom < 0) offset += (0.5 * (gm - gp)) / denom
    }
    points.push({ x: cx + n.x * offset, y: cy + n.y * offset })
  }
  return { points, samples }
}

/** Total least squares line through points. Null when degenerate. */
function fitLine(points: Point[]): Line | null {
  if (points.length < 2) return null
  let mx = 0
  let my = 0
  for (const p of points) {
    mx += p.x
    my += p.y
  }
  mx /= points.length
  my /= points.length
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const p of points) {
    const dx = p.x - mx
    const dy = p.y - my
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  if (sxx + syy === 0) return null
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  return { p: { x: mx, y: my }, d: { x: Math.cos(angle), y: Math.sin(angle) } }
}

function distance(line: Line, q: Point): number {
  return Math.abs((q.x - line.p.x) * line.d.y - (q.y - line.p.y) * line.d.x)
}

function inliersOf(line: Line, points: Point[]): Point[] {
  return points.filter((q) => distance(line, q) <= RANSAC_THRESHOLD_PX)
}

/** RANSAC with a fixed seed, then TLS over the best consensus set. */
function robustLine(points: Point[], minInliers: number): Line | null {
  if (points.length < minInliers) return null
  const rand = prng(RANSAC_SEED)
  let best: Point[] = []
  for (let it = 0; it < RANSAC_ITERATIONS; it++) {
    const i = Math.floor(rand() * points.length)
    let j = Math.floor(rand() * (points.length - 1))
    if (j >= i) j++
    const a = points[i]
    const b = points[j]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (!(len > 0)) continue
    const candidate = inliersOf({ p: a, d: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } }, points)
    if (candidate.length > best.length) best = candidate
  }
  if (best.length < minInliers) return null
  const first = fitLine(best)
  if (!first) return null
  const refined = inliersOf(first, points)
  if (refined.length < minInliers) return null
  return fitLine(refined)
}

function intersect(l1: Line, l2: Line): Point | null {
  const det = l1.d.x * l2.d.y - l1.d.y * l2.d.x
  if (Math.abs(det) < 1e-6) return null
  const dx = l2.p.x - l1.p.x
  const dy = l2.p.y - l1.p.y
  const s = (dx * l2.d.y - dy * l2.d.x) / det
  return { x: l1.p.x + l1.d.x * s, y: l1.p.y + l1.d.y * s }
}

/**
 * Refines a quad against the full-resolution image. Returns the SAME quad object when the
 * refinement is not trustworthy (too few edge points, parallel sides, invalid result, or a
 * corner moving more than the cap). Never throws, never mutates its inputs.
 */
export function refineQuad(image: PixelImage, quad: Quad): Quad {
  try {
    if (!isValidImage(image) || !validateQuad(quad)) return quad
    let shortest = Infinity
    for (let i = 0; i < 4; i++) {
      const a = quad[i]
      const b = quad[(i + 1) % 4]
      shortest = Math.min(shortest, Math.hypot(b.x - a.x, b.y - a.y))
    }
    const halfStrip = Math.max(MIN_STRIP_PX, STRIP_FRACTION * shortest)
    const maxMove = MAX_MOVE_STRIPS * halfStrip

    const lines: Line[] = []
    for (let i = 0; i < 4; i++) {
      const { points, samples } = edgePoints(image, quad[i], quad[(i + 1) % 4], halfStrip)
      const minInliers = Math.max(MIN_INLIERS, Math.ceil(MIN_INLIER_RATIO * samples))
      const line = robustLine(points, minInliers)
      if (!line) return quad
      lines.push(line)
    }

    const refined: Point[] = []
    for (let i = 0; i < 4; i++) {
      // Corner i joins side i-1 (quad[i-1] → quad[i]) and side i (quad[i] → quad[i+1]).
      const corner = intersect(lines[(i + 3) % 4], lines[i])
      if (!corner) return quad
      if (Math.hypot(corner.x - quad[i].x, corner.y - quad[i].y) > maxMove) return quad
      refined.push(corner)
    }
    const result = refined as Quad
    return validateQuad(result) ? result : quad
  } catch {
    return quad
  }
}
