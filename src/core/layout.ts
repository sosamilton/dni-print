// Sheet layout (AD-5): pure, in mm. Its result feeds the preview and `buildPdf` by value.
import type { DocumentProfile } from './profiles.ts'

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const MIN_MARGIN_MM = 5
export const GAP_MM = 5
export const RULER_LENGTH_MM = 100
/** Minimum free height below the last row for the ruler and its label. */
export const RULER_MIN_STRIP_MM = 12

export interface Margins {
  topMm: number
  rightMm: number
  bottomMm: number
  leftMm: number
}

export function uniformMargins(mm: number): Margins {
  return { topMm: mm, rightMm: mm, bottomMm: mm, leftMm: mm }
}

export interface Placement {
  face: 'front' | 'back'
  /** 0-based copy (row) index. */
  copy: number
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export interface Ruler {
  xMm: number
  yMm: number
  lengthMm: number
}

/** Horizontal cut guide across the sheet (2 copies): each half is one complete copy. */
export interface CutLine {
  yMm: number
  x1Mm: number
  x2Mm: number
}

export type LayoutResult =
  | { ok: true; placements: Placement[]; ruler: Ruler; cutLine: CutLine | null }
  | { ok: false; reason: 'no-cabe' | 'margen-invalido' }

function rowPlacements(profile: DocumentProfile, copy: number, leftMm: number, yMm: number): Placement[] {
  const { widthMm, heightMm } = profile
  return [
    { face: 'front', copy, xMm: leftMm, yMm, widthMm, heightMm },
    { face: 'back', copy, xMm: leftMm + widthMm + GAP_MM, yMm, widthMm, heightMm },
  ]
}

/** Centers `size` in [lo, hi] (the half), then clamps into [min, max]; null if that range is empty. */
function centeredWithin(lo: number, hi: number, size: number, min: number, max: number): number | null {
  if (min > max) return null
  return Math.min(max, Math.max(min, lo + (hi - lo - size) / 2))
}

export function layout(profile: DocumentProfile, copies: 1 | 2, margins: Margins): LayoutResult {
  const sides = [margins.topMm, margins.rightMm, margins.bottomMm, margins.leftMm]
  if (sides.some((m) => !Number.isFinite(m) || m < MIN_MARGIN_MM)) {
    return { ok: false, reason: 'margen-invalido' }
  }
  if (copies !== 1 && copies !== 2) return { ok: false, reason: 'no-cabe' }

  const availableWidthMm = A4_WIDTH_MM - margins.leftMm - margins.rightMm
  const blockWidthMm = 2 * profile.widthMm + GAP_MM
  if (blockWidthMm > availableWidthMm || RULER_LENGTH_MM > availableWidthMm) {
    return { ok: false, reason: 'no-cabe' }
  }
  const leftMm = margins.leftMm + (availableWidthMm - blockWidthMm) / 2
  const rulerXMm = margins.leftMm + (availableWidthMm - RULER_LENGTH_MM) / 2
  const bottomLimitMm = A4_HEIGHT_MM - margins.bottomMm

  if (copies === 1) {
    const rowBottomMm = margins.topMm + profile.heightMm
    const stripMm = bottomLimitMm - rowBottomMm
    if (stripMm < RULER_MIN_STRIP_MM) return { ok: false, reason: 'no-cabe' }
    return {
      ok: true,
      placements: rowPlacements(profile, 0, leftMm, margins.topMm),
      ruler: { xMm: rulerXMm, yMm: rowBottomMm + stripMm / 2, lengthMm: RULER_LENGTH_MM },
      cutLine: null,
    }
  }

  // 2 copies: each copy centered in its half of the sheet; the ruler goes under copy 1.
  const h = profile.heightMm
  const halfMm = A4_HEIGHT_MM / 2
  const y0 = centeredWithin(0, halfMm, h, margins.topMm, halfMm - h)
  const y1 = centeredWithin(halfMm, A4_HEIGHT_MM, h, halfMm, bottomLimitMm - RULER_MIN_STRIP_MM - h)
  if (y0 === null || y1 === null) return { ok: false, reason: 'no-cabe' }
  const copy1BottomMm = y1 + h
  return {
    ok: true,
    placements: [...rowPlacements(profile, 0, leftMm, y0), ...rowPlacements(profile, 1, leftMm, y1)],
    ruler: { xMm: rulerXMm, yMm: (copy1BottomMm + bottomLimitMm) / 2, lengthMm: RULER_LENGTH_MM },
    cutLine: { yMm: halfMm, x1Mm: margins.leftMm, x2Mm: A4_WIDTH_MM - margins.rightMm },
  }
}
