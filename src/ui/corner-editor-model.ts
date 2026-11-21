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

// --- Magnifier geometry (story 6.1) ---

/** Fallbacks when the CSS tokens can't be read. */
export const MAGNIFIER_SIZE_PX = 150
export const MAGNIFIER_ZOOM = 3

type SourceSize = { widthPx: number; heightPx: number }
type PreviewSize = { width: number; height: number }

/** Source rect (preview px, clipped to the image) and destination rect (magnifier px). */
export interface MagnifierWindow {
  sx: number
  sy: number
  sw: number
  sh: number
  dx: number
  dy: number
  dw: number
  dh: number
}

interface Frame {
  scaleX: number
  scaleY: number
  cx: number
  cy: number
  span: number
  k: number
}

function magnifierFrame(
  point: Point,
  sourceSize: SourceSize,
  previewSize: PreviewSize,
  displayedWidth: number,
  sizePx: number,
  zoom: number,
): Frame | null {
  if (
    !(displayedWidth > 0) ||
    !(previewSize.width > 0) ||
    !(previewSize.height > 0) ||
    !(sourceSize.widthPx > 0) ||
    !(sourceSize.heightPx > 0) ||
    !(sizePx > 0) ||
    !(zoom > 0)
  )
    return null
  const scaleX = previewSize.width / sourceSize.widthPx
  const scaleY = previewSize.height / sourceSize.heightPx
  // S CSS px of magnifier show S/zoom CSS px of the on-screen image.
  const span = (sizePx / zoom) * (previewSize.width / displayedWidth)
  return { scaleX, scaleY, cx: point.x * scaleX, cy: point.y * scaleY, span, k: sizePx / span }
}

/**
 * Window to magnify around `point` (source px). The square is clipped to the
 * image (never shifted), so the point always lands at the magnifier centre.
 * Null when there is nothing to draw.
 */
export function magnifierWindow(
  point: Point,
  sourceSize: SourceSize,
  previewSize: PreviewSize,
  /** Width of the image on screen (CSS px). */
  displayedWidth: number,
  /** Magnifier diameter (CSS px). */
  sizePx: number,
  /** Magnification relative to the on-screen image. */
  zoom: number,
): MagnifierWindow | null {
  const f = magnifierFrame(point, sourceSize, previewSize, displayedWidth, sizePx, zoom)
  if (!f) return null
  const x0 = f.cx - f.span / 2
  const y0 = f.cy - f.span / 2
  const sx = Math.max(0, x0)
  const sy = Math.max(0, y0)
  const ex = Math.min(previewSize.width, x0 + f.span)
  const ey = Math.min(previewSize.height, y0 + f.span)
  if (ex <= sx || ey <= sy) return null
  return {
    sx,
    sy,
    sw: ex - sx,
    sh: ey - sy,
    dx: (sx - x0) * f.k,
    dy: (sy - y0) * f.k,
    dw: (ex - sx) * f.k,
    dh: (ey - sy) * f.k,
  }
}

/** Maps a source-px point to magnifier coords for a magnifier centred on `center`. */
export function toMagnifier(
  p: Point,
  center: Point,
  sourceSize: SourceSize,
  previewSize: PreviewSize,
  displayedWidth: number,
  sizePx: number,
  zoom: number,
): Point | null {
  const f = magnifierFrame(center, sourceSize, previewSize, displayedWidth, sizePx, zoom)
  if (!f) return null
  return {
    x: (p.x * f.scaleX - f.cx) * f.k + sizePx / 2,
    y: (p.y * f.scaleY - f.cy) * f.k + sizePx / 2,
  }
}

/** The two neighbours of corner `index`: the quad sides that leave it. */
export function adjacentCorners(quad: Quad, index: number): [Point, Point] {
  return [quad[(index + 1) % 4], quad[(index + 3) % 4]]
}

/** Magnifier goes to the horizontal and vertical side opposite the point. */
export function magnifierSide(
  point: Point,
  sourceSize: SourceSize,
): { x: 'left' | 'right'; y: 'top' | 'bottom' } {
  return {
    x: point.x < sourceSize.widthPx / 2 ? 'right' : 'left',
    y: point.y < sourceSize.heightPx / 2 ? 'bottom' : 'top',
  }
}
