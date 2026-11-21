// Single source of the sheet layout: the preview and `buildPdf` both use this (AD-5).
import { getProfile, layout, MIN_MARGIN_MM, uniformMargins } from '../core/index.ts'
import type { FaceFilter, LayoutResult } from '../core/index.ts'
import { strings } from './strings.es.ts'

export const DEFAULT_MARGIN_MM = 10
export const MAX_MARGIN_MM = 20
export { MIN_MARGIN_MM }

export function clampMargin(mm: number): number {
  if (!Number.isFinite(mm)) return DEFAULT_MARGIN_MM
  return Math.min(MAX_MARGIN_MM, Math.max(MIN_MARGIN_MM, Math.round(mm)))
}

export function sheetLayout(profileId: string, copies: 1 | 2, marginMm: number = DEFAULT_MARGIN_MM): LayoutResult {
  const profile = getProfile(profileId)
  if (!profile) return { ok: false, reason: 'no-cabe' }
  return layout(profile, copies, uniformMargins(marginMm))
}

/** Largest whole margin (≤ 20 mm) with which the chosen copies still fit; never below the minimum. */
export function maxMarginMm(profileId: string, copies: 1 | 2): number {
  for (let mm = MAX_MARGIN_MM; mm > MIN_MARGIN_MM; mm--) {
    if (sheetLayout(profileId, copies, mm).ok) return mm
  }
  return MIN_MARGIN_MM
}

export function previewDescription(copies: 1 | 2, filter: FaceFilter, watermark: boolean): string {
  const copy = strings.printStep
  return [copy.previewBase(copies), copy.previewFilters[filter], watermark ? copy.previewWatermark : null]
    .filter(Boolean)
    .join(', ')
}
