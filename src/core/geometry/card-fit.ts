// Card-shaped quad search over an RGBA image: Hough lines from the gradient field, quads built from four lines
// whose normals turn ~90° each, and a score that mixes edge support along the sides with the document's shape.
// Pure and deterministic: no DOM, no randomness. The camera (scanic) is not involved.
import { validateQuad } from './quad.ts'
import type { PixelImage, Point, Quad } from './types.ts'

/** Real-world width / height of the card (ISO/IEC 7810 ID-1). Shape prior only; callers may pass the profile's own. */
export const CARD_ASPECT = 85.6 / 54

export interface CardFitOptions {
  /** Expected long / short side ratio of the document. */
  aspect?: number
}

/** A straight edge as a signed normal (gradient direction, pointing from dark to bright) and its offset. */
export interface HoughLine {
  /** Normal angle in radians, [0, 2π). */
  theta: number
  /** x·cosθ + y·sinθ = rho. */
  rho: number
  /** Edge pixels that voted for it. */
  votes: number
}

export interface CardCandidate {
  quad: Quad
  /** 0..1: edge support × shape × size. Higher is better. */
  score: number
  /** Lowest per-side edge support (0..1). */
  minSupport: number
}

const TWO_PI = Math.PI * 2
const THETA_BINS = 360
const MAX_LINES = 70
const MIN_LINE_VOTES = 18
const THETA_NMS_BINS = 7
const RHO_NMS_PX = 9
const ANGLE_TOLERANCE = (28 * Math.PI) / 180
const MIN_AREA_FRACTION = 0.01
const SUPPORT_SEARCH_PX = 3
const SUPPORT_COS = Math.cos((25 * Math.PI) / 180)
const SIDE_SAMPLE_SPACING_PX = 3
const SIDE_SKIP = 0.08
/** Gradient floor, as a fraction of the 99th percentile of the gradient magnitude, and an absolute floor. */
const MAG_FRACTION = 0.12
const MIN_MAG = 5

export interface Gradient {
  width: number
  height: number
  gx: Float32Array
  gy: Float32Array
  mag: Float32Array
  /** Edge-pixel gate. */
  threshold: number
}

export function gradientOf(img: PixelImage, fraction: number = MAG_FRACTION, floor: number = MIN_MAG): Gradient {
  const { width: w, height: h, data } = img
  const gx = new Float32Array(w * h)
  const gy = new Float32Array(w * h)
  const mag = new Float32Array(w * h)
  // Per channel Sobel over a lightly blurred copy; each pixel keeps the channel with the strongest edge, so a
  // chroma-only border (pink card on white paper) counts as much as a luma one.
  const chan = new Float32Array(w * h)
  const tmp = new Float32Array(w * h)
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < w * h; i++) chan[i] = data[i * 4 + c]
    // Separable 1-2-1 blur.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = chan[y * w + Math.max(0, x - 1)]
        const r = chan[y * w + Math.min(w - 1, x + 1)]
        tmp[y * w + x] = (l + 2 * chan[y * w + x] + r) / 4
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = tmp[Math.max(0, y - 1) * w + x]
        const b = tmp[Math.min(h - 1, y + 1) * w + x]
        chan[y * w + x] = (t + 2 * tmp[y * w + x] + b) / 4
      }
    }
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const k = (xx: number, yy: number) => chan[yy * w + xx]
        const sx = (k(x + 1, y - 1) + 2 * k(x + 1, y) + k(x + 1, y + 1) - k(x - 1, y - 1) - 2 * k(x - 1, y) - k(x - 1, y + 1)) / 8
        const sy = (k(x - 1, y + 1) + 2 * k(x, y + 1) + k(x + 1, y + 1) - k(x - 1, y - 1) - 2 * k(x, y - 1) - k(x + 1, y - 1)) / 8
        const m = Math.hypot(sx, sy)
        const i = y * w + x
        if (m > mag[i]) {
          mag[i] = m
          gx[i] = sx
          gy[i] = sy
        }
      }
    }
  }
  const sorted = Float32Array.from(mag).sort()
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0
  return { width: w, height: h, gx, gy, mag, threshold: Math.max(floor, fraction * p99) }
}

/** Hough peaks over signed gradient normals; each line is then re-fitted on the pixels that support it. */
export function houghLines(g: Gradient): HoughLine[] {
  const { width: w, height: h } = g
  const diag = Math.ceil(Math.hypot(w, h))
  const rhoBins = 2 * diag + 1
  const acc = new Float32Array(THETA_BINS * rhoBins)
  const cos = new Float32Array(THETA_BINS)
  const sin = new Float32Array(THETA_BINS)
  for (let t = 0; t < THETA_BINS; t++) {
    cos[t] = Math.cos((t * TWO_PI) / THETA_BINS)
    sin[t] = Math.sin((t * TWO_PI) / THETA_BINS)
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (g.mag[i] < g.threshold) continue
      const angle = Math.atan2(g.gy[i], g.gx[i])
      const t0 = Math.round(((angle + TWO_PI) % TWO_PI) / (TWO_PI / THETA_BINS))
      for (let dt = -1; dt <= 1; dt++) {
        const t = (t0 + dt + THETA_BINS) % THETA_BINS
        const r = Math.round(x * cos[t] + y * sin[t]) + diag
        acc[t * rhoBins + r] += dt === 0 ? 1 : 0.5
      }
    }
  }
  // Smooth over a 3×3 (θ, rho) neighbourhood, then greedy non-maximum suppression.
  const cells: { t: number; r: number; v: number }[] = []
  for (let t = 0; t < THETA_BINS; t++) {
    for (let r = 1; r < rhoBins - 1; r++) {
      const v = acc[t * rhoBins + r]
      if (v < MIN_LINE_VOTES) continue
      cells.push({ t, r, v: v + 0.5 * (acc[t * rhoBins + r - 1] + acc[t * rhoBins + r + 1]) })
    }
  }
  cells.sort((a, b) => b.v - a.v)
  const kept: { t: number; r: number; v: number }[] = []
  for (const c of cells) {
    if (kept.length >= MAX_LINES) break
    const clash = kept.some((k) => {
      const dt = Math.min(Math.abs(k.t - c.t), THETA_BINS - Math.abs(k.t - c.t))
      return dt <= THETA_NMS_BINS && Math.abs(k.r - c.r) <= RHO_NMS_PX
    })
    if (!clash) kept.push(c)
  }
  return kept.map((k) => refineLine(g, ((k.t * TWO_PI) / THETA_BINS), k.r - diag, k.v))
}

/** Total least squares over the edge pixels near the Hough line with a compatible normal. */
function refineLine(g: Gradient, theta: number, rho: number, votes: number): HoughLine {
  const { width: w, height: h } = g
  const nx = Math.cos(theta)
  const ny = Math.sin(theta)
  let sx = 0
  let sy = 0
  let n = 0
  const pts: number[] = []
  const seen = new Set<number>()
  // Walk only the pixels within 3 px of the line.
  const horizontal = Math.abs(ny) > Math.abs(nx)
  const span = horizontal ? w : h
  for (let s = 1; s < span - 1; s++) {
    for (let o = -3; o <= 3; o++) {
      // Position on the line at param s, then displaced along the normal by o.
      const x = horizontal ? s : Math.round((rho - ny * s) / nx)
      const y = horizontal ? Math.round((rho - nx * s) / ny) : s
      const px = Math.round(x + nx * o)
      const py = Math.round(y + ny * o)
      if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue
      const i = py * w + px
      if (g.mag[i] < g.threshold || seen.has(i)) continue
      if ((g.gx[i] * nx + g.gy[i] * ny) / g.mag[i] < SUPPORT_COS) continue
      if (Math.abs(px * nx + py * ny - rho) > 2.5) continue
      seen.add(i)
      pts.push(px, py)
      sx += px
      sy += py
      n++
    }
  }
  if (n < 6) return { theta, rho, votes }
  const mx = sx / n
  const my = sy / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let k = 0; k < pts.length; k += 2) {
    const dx = pts[k] - mx
    const dy = pts[k + 1] - my
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  // The line direction is the principal axis; the normal is perpendicular, signed like the original one.
  const dir = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  let ntheta = dir + Math.PI / 2
  if (Math.cos(ntheta) * nx + Math.sin(ntheta) * ny < 0) ntheta += Math.PI
  ntheta = ((ntheta % TWO_PI) + TWO_PI) % TWO_PI
  return { theta: ntheta, rho: mx * Math.cos(ntheta) + my * Math.sin(ntheta), votes }
}

function intersect(a: HoughLine, b: HoughLine): Point | null {
  const ca = Math.cos(a.theta)
  const sa = Math.sin(a.theta)
  const cb = Math.cos(b.theta)
  const sb = Math.sin(b.theta)
  const det = ca * sb - sa * cb
  if (Math.abs(det) < 0.2) return null
  return { x: (a.rho * sb - b.rho * sa) / det, y: (b.rho * ca - a.rho * cb) / det }
}

const angleDiff = (a: number, b: number): number => {
  const d = (((b - a) % TWO_PI) + TWO_PI) % TWO_PI
  return d
}

/** Counts how much of the side p→q is an edge whose gradient points along `normal` (within a few px). */
function sideSupport(g: Gradient, p: Point, q: Point, normal: Point): number {
  const len = Math.hypot(q.x - p.x, q.y - p.y)
  const n = Math.max(6, Math.floor((len * (1 - 2 * SIDE_SKIP)) / SIDE_SAMPLE_SPACING_PX))
  let hits = 0
  let taken = 0
  for (let s = 0; s < n; s++) {
    const t = SIDE_SKIP + ((1 - 2 * SIDE_SKIP) * (s + 0.5)) / n
    const cx = p.x + (q.x - p.x) * t
    const cy = p.y + (q.y - p.y) * t
    taken++
    for (let o = -SUPPORT_SEARCH_PX; o <= SUPPORT_SEARCH_PX; o++) {
      const x = Math.round(cx + normal.x * o)
      const y = Math.round(cy + normal.y * o)
      if (x < 1 || y < 1 || x >= g.width - 1 || y >= g.height - 1) continue
      const i = y * g.width + x
      if (g.mag[i] >= g.threshold && (g.gx[i] * normal.x + g.gy[i] * normal.y) / g.mag[i] >= SUPPORT_COS) {
        hits++
        break
      }
    }
  }
  return taken ? hits / taken : 0
}

/**
 * Orders four corners clockwise on screen (y down) starting at the one nearest the top-left (smallest x + y).
 * Sorting by angle first keeps the four corners distinct for documents rotated near 45°.
 */
export function orderCorners(pts: Point[]): Quad {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const cyclic = [...pts].sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx))
  let start = 0
  cyclic.forEach((p, i) => {
    if (p.x + p.y < cyclic[start].x + cyclic[start].y) start = i
  })
  return [0, 1, 2, 3].map((k) => cyclic[(start + k) % 4]) as Quad
}

/** Shape plausibility 0..1 of a quad given the expected long/short ratio; 0 for implausible ones. */
export function shapeScore(quad: Quad, aspect: number): number {
  const side = (i: number) => Math.hypot(quad[(i + 1) % 4].x - quad[i].x, quad[(i + 1) % 4].y - quad[i].y)
  const s = [side(0), side(1), side(2), side(3)]
  if (s.some((v) => !(v > 0))) return 0
  // Opposite sides must be alike (moderate perspective).
  const pair = (a: number, b: number) => Math.min(a, b) / Math.max(a, b)
  const parallel = Math.min(pair(s[0], s[2]), pair(s[1], s[3]))
  if (parallel < 0.7) return 0
  const a = (s[0] + s[2]) / 2
  const b = (s[1] + s[3]) / 2
  const ratio = Math.max(a, b) / Math.min(a, b)
  const z = (ratio - aspect) / (0.14 * aspect)
  return Math.exp(-z * z) * parallel
}

/** All plausible quads from the image, best first. */
export function cardCandidates(img: PixelImage, options: CardFitOptions = {}): CardCandidate[] {
  const aspect = options.aspect ?? CARD_ASPECT
  const g = gradientOf(img)
  const lines = houghLines(g)
  const byTurn = (a: HoughLine, turn: number) =>
    lines.filter((l) => l !== a && Math.abs(angleDiff(a.theta, l.theta) - turn) <= ANGLE_TOLERANCE)
  const out: CardCandidate[] = []
  const imageArea = img.width * img.height
  const seen = new Set<string>()
  lines.forEach((a, ia) => {
    for (const b of byTurn(a, Math.PI / 2)) {
      for (const c of byTurn(b, Math.PI / 2)) {
        if (Math.abs(angleDiff(a.theta, c.theta) - Math.PI) > ANGLE_TOLERANCE) continue
        for (const d of byTurn(c, Math.PI / 2)) {
          if (Math.abs(angleDiff(a.theta, d.theta) - (3 * Math.PI) / 2) > ANGLE_TOLERANCE) continue
          if (Math.abs(angleDiff(d.theta, a.theta) - Math.PI / 2) > ANGLE_TOLERANCE) continue
          const ls = [a, b, c, d]
          if (ls.some((l, i) => ls.indexOf(l) !== i)) continue
          if (lines.indexOf(b) < ia || lines.indexOf(c) < ia || lines.indexOf(d) < ia) continue // `a` is the first line index: one start per loop
          const key = ls.map((l) => lines.indexOf(l)).sort((x, y) => x - y).join(',')
          if (seen.has(key)) continue
          seen.add(key)
          const corners = [intersect(d, a), intersect(a, b), intersect(b, c), intersect(c, d)]
          if (corners.some((p) => !p)) continue
          const pts = corners as Point[]
          // Corners may poke out of the frame a little (card cut by the border), never far.
          const margin = 0.03 * Math.max(img.width, img.height)
          if (pts.some((p) => p.x < -margin || p.y < -margin || p.x > img.width + margin || p.y > img.height + margin)) continue
          const quad = orderCorners(pts)
          if (!validateQuad(quad)) continue
          let area = 0
          for (let i = 0; i < 4; i++) area += quad[i].x * quad[(i + 1) % 4].y - quad[(i + 1) % 4].x * quad[i].y
          area = Math.abs(area) / 2
          if (area < MIN_AREA_FRACTION * imageArea) continue
          const shape = shapeScore(quad, aspect)
          if (shape <= 0.2) continue
          // Side i of the loop a→b→c→d joins pts[i] and pts[i+1]: its edge normal is ls[i].
          let minSupport = 1
          let sum = 0
          for (let i = 0; i < 4; i++) {
            const l = ls[i]
            const sup = sideSupport(g, pts[i], pts[(i + 1) % 4], { x: Math.cos(l.theta), y: Math.sin(l.theta) })
            minSupport = Math.min(minSupport, sup)
            sum += sup
          }
          // The weakest side counts as much as the average: a candidate missing one edge is not a card.
          const support = 0.5 * (sum / 4) + 0.5 * minSupport
          out.push({ quad, score: support * shape * Math.pow(area / imageArea, 0.15), minSupport })
        }
      }
    }
  })
  return out.sort((x, y) => y.score - x.score)
}

/** A candidate below this score (or with a side this poorly supported) is "dudosa": better no quad than a wrong one. */
export const MIN_ACCEPT_SCORE = 0.3
export const MIN_ACCEPT_SIDE_SUPPORT = 0.6

/** Picks the quad that best fits a document of the given shape, or null when none is convincing. Never throws. */
export function findCardQuad(img: PixelImage, options: CardFitOptions = {}): Quad | null {
  try {
    if (!(img.width >= 16 && img.height >= 16) || img.data.length < img.width * img.height * 4) return null
    const best = cardCandidates(img, options).find((c) => c.score >= MIN_ACCEPT_SCORE && c.minSupport >= MIN_ACCEPT_SIDE_SUPPORT)
    return best ? best.quad : null
  } catch {
    return null
  }
}
