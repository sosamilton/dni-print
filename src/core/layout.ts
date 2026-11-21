// Sheet layout (AD-5): pure, in mm. Its result feeds the preview and `buildPdf` by value.
import type { DocumentProfile } from './profiles.ts'

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const MIN_MARGIN_MM = 5
export const GAP_MM = 5
export const ROW_GAP_MM = 10
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

export type LayoutResult =
  | { ok: true; placements: Placement[]; ruler: Ruler }
  | { ok: false; reason: 'no-cabe' | 'margen-invalido' }

export function layout(profile: DocumentProfile, copies: 1 | 2, margins: Margins): LayoutResult {
  const sides = [margins.topMm, margins.rightMm, margins.bottomMm, margins.leftMm]
  if (sides.some((m) => !Number.isFinite(m) || m < MIN_MARGIN_MM)) {
    return { ok: false, reason: 'margen-invalido' }
  }
  if (copies !== 1 && copies !== 2) return { ok: false, reason: 'no-cabe' }

  const availableWidthMm = A4_WIDTH_MM - margins.leftMm - margins.rightMm
  const availableHeightMm = A4_HEIGHT_MM - margins.topMm - margins.bottomMm
  const blockWidthMm = 2 * profile.widthMm + GAP_MM
  const blockHeightMm = copies * profile.heightMm + (copies - 1) * ROW_GAP_MM
  const stripMm = availableHeightMm - blockHeightMm
  if (blockWidthMm > availableWidthMm || RULER_LENGTH_MM > availableWidthMm || stripMm < RULER_MIN_STRIP_MM) {
    return { ok: false, reason: 'no-cabe' }
  }

  const leftMm = margins.leftMm + (availableWidthMm - blockWidthMm) / 2
  const placements: Placement[] = []
  for (let copy = 0; copy < copies; copy++) {
    const yMm = margins.topMm + copy * (profile.heightMm + ROW_GAP_MM)
    placements.push({ face: 'front', copy, xMm: leftMm, yMm, widthMm: profile.widthMm, heightMm: profile.heightMm })
    placements.push({
      face: 'back',
      copy,
      xMm: leftMm + profile.widthMm + GAP_MM,
      yMm,
      widthMm: profile.widthMm,
      heightMm: profile.heightMm,
    })
  }
  const ruler: Ruler = {
    xMm: margins.leftMm + (availableWidthMm - RULER_LENGTH_MM) / 2,
    yMm: margins.topMm + blockHeightMm + stripMm / 2,
    lengthMm: RULER_LENGTH_MM,
  }
  return { ok: true, placements, ruler }
}
