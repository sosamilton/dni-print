// Synthetic test scenes: a light rounded card on a dark background, antialiased by supersampling.
import { applyHomography, solveHomography } from '../../src/core/geometry/homography.ts'
import type { PixelImage, Point, Quad } from '../../src/core/geometry/types.ts'

export interface SceneOptions {
  width: number
  height: number
  /** Where the card's (straight-edge) corners land, TL, TR, BR, BL. */
  corners: Quad
  /** Card size in its own units; corner radius as a fraction of cardWidth. */
  cardWidth?: number
  cardHeight?: number
  radius?: number
  card?: number
  background?: number
  /** Amplitude of deterministic uniform noise added to every pixel. */
  noise?: number
  /** Extra filled rectangles drawn over the scene, in scene px. */
  occluders?: { x0: number; y0: number; x1: number; y1: number; value: number }[]
  supersample?: number
}

function insideRoundedRect(u: number, v: number, w: number, h: number, r: number): boolean {
  if (u < 0 || v < 0 || u > w || v > h) return false
  const cx = Math.min(Math.max(u, r), w - r)
  const cy = Math.min(Math.max(v, r), h - r)
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r
}

export function makeScene(o: SceneOptions): PixelImage {
  const cw = o.cardWidth ?? 856
  const ch = o.cardHeight ?? 540
  const r = (o.radius ?? 0.04) * cw
  const card = o.card ?? 220
  const bg = o.background ?? 30
  const ss = o.supersample ?? 4
  const toCard = solveHomography(o.corners, [
    { x: 0, y: 0 },
    { x: cw, y: 0 },
    { x: cw, y: ch },
    { x: 0, y: ch },
  ])
  if (!toCard) throw new Error('bad corners')
  let seed = 12345
  const rand = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
    return seed / 4294967296
  }
  const data = new Uint8ClampedArray(o.width * o.height * 4)
  for (let y = 0; y < o.height; y++) {
    for (let x = 0; x < o.width; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const p = applyHomography(toCard, x + (sx + 0.5) / ss, y + (sy + 0.5) / ss)
          if (insideRoundedRect(p.x, p.y, cw, ch, r)) hits++
        }
      }
      let value = bg + ((card - bg) * hits) / (ss * ss)
      for (const occ of o.occluders ?? []) {
        if (x >= occ.x0 && x < occ.x1 && y >= occ.y0 && y < occ.y1) value = occ.value
      }
      if (o.noise) value += (rand() * 2 - 1) * o.noise
      const i = (y * o.width + x) * 4
      data[i] = data[i + 1] = data[i + 2] = value
      data[i + 3] = 255
    }
  }
  return { width: o.width, height: o.height, data }
}

export function meanCornerError(a: Quad, b: Quad): number {
  return a.reduce((sum, p, i) => sum + Math.hypot(p.x - b[i].x, p.y - b[i].y), 0) / 4
}

/** Moves each corner by a fixed, varied offset (≈ ±amount px). */
export function perturb(q: Quad, amount: number): Quad {
  const offsets: Point[] = [
    { x: amount, y: -amount * 0.6 },
    { x: -amount * 0.7, y: amount },
    { x: -amount, y: -amount * 0.8 },
    { x: amount * 0.5, y: amount * 0.9 },
  ]
  return q.map((p, i) => ({ x: p.x + offsets[i].x, y: p.y + offsets[i].y })) as Quad
}
