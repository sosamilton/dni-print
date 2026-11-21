import type { Point, Quad, Rotation } from './types.ts'

const MIN_AREA_PX = 1

/** The only place rotation is applied: cyclic vertex shift. Returns null for invalid rotation. */
export function orientQuad(quad: Quad, rotation: number): Quad | null {
  if (rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270) return null
  const shift = (rotation as Rotation) / 90
  return [0, 1, 2, 3].map((i) => quad[(i + 4 - shift) % 4]) as Quad
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
}

/** True for a finite, non-degenerate, strictly convex quad in TL, TR, BR, BL (clockwise) order. Never throws. */
export function validateQuad(quad: Quad): boolean {
  if (!Array.isArray(quad) || quad.length !== 4) return false
  for (const p of quad) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false
  }
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const c = cross(quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4])
    if (c === 0) return false
    const s = c > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  // TL, TR, BR, BL must run clockwise on screen (y down); a mirrored order would flip the document.
  if (sign < 0) return false
  let area = 0
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    area += a.x * b.y - b.x * a.y
  }
  return Math.abs(area) / 2 > MIN_AREA_PX
}

/** Rectangle with a 10 % inner margin per side. Throws RangeError on bad size (programmer error). */
export function defaultQuad(widthPx: number, heightPx: number): Quad {
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx <= 0 || heightPx <= 0) {
    throw new RangeError('defaultQuad: width and height must be positive finite numbers')
  }
  const mx = widthPx * 0.1
  const my = heightPx * 0.1
  return [
    { x: mx, y: my },
    { x: widthPx - mx, y: my },
    { x: widthPx - mx, y: heightPx - my },
    { x: mx, y: heightPx - my },
  ]
}
