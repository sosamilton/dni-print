// Pure logic of the corner editor (story 2.4): no React, no DOM.
import { orientQuad, validateQuad } from '../core/index.ts'
import type { Point, Quad, Rotation } from '../core/index.ts'

export const LOW_RESOLUTION_PX = 600
export const STEP_PX = 1
export const BIG_STEP_PX = 10

export const CORNER_KEYS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const
export type CornerKey = (typeof CORNER_KEYS)[number]

/** Keeps a point inside the source image. */
export function clampPoint(point: Point, widthPx: number, heightPx: number): Point {
  return {
    x: Math.min(Math.max(point.x, 0), widthPx),
    y: Math.min(Math.max(point.y, 0), heightPx),
  }
}

/** Replaces one vertex; returns a new quad. */
export function withCorner(quad: Quad, index: number, point: Point): Quad {
  return quad.map((p, i) => (i === index ? point : p)) as Quad
}

/** Arrow-key movement in source px; null when the key is not an arrow. */
export function keyDelta(key: string, shift: boolean): Point | null {
  const step = shift ? BIG_STEP_PX : STEP_PX
  switch (key) {
    case 'ArrowLeft':
      return { x: -step, y: 0 }
    case 'ArrowRight':
      return { x: step, y: 0 }
    case 'ArrowUp':
      return { x: 0, y: -step }
    case 'ArrowDown':
      return { x: 0, y: step }
    default:
      return null
  }
}

/** Screen offset (px, relative to the displayed image) to source px. */
export function screenToSource(
  offset: Point,
  displayed: { width: number; height: number },
  source: { widthPx: number; heightPx: number },
): Point {
  if (displayed.width <= 0 || displayed.height <= 0) return { x: 0, y: 0 }
  return clampPoint(
    { x: (offset.x / displayed.width) * source.widthPx, y: (offset.y / displayed.height) * source.heightPx },
    source.widthPx,
    source.heightPx,
  )
}

/** Width of the crop in source px, as the rendered face will see it (after rotation). */
export function cropWidthPx(quad: Quad, rotation: Rotation): number {
  const oriented = orientQuad(quad, rotation)
  if (!oriented) return 0
  const [tl, tr, br, bl] = oriented
  return (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2
}

export function isLowResolution(quad: Quad, rotation: Rotation): boolean {
  return validateQuad(quad) && cropWidthPx(quad, rotation) < LOW_RESOLUTION_PX
}

export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation
}
