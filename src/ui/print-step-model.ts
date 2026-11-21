// Single source of the sheet layout: the preview and `buildPdf` both use this (AD-5).
import { getProfile, layout, uniformMargins } from '../core/index.ts'
import type { LayoutResult } from '../core/index.ts'

export const SHEET_MARGIN_MM = 10

export function sheetLayout(profileId: string, copies: 1 | 2): LayoutResult {
  const profile = getProfile(profileId)
  if (!profile) return { ok: false, reason: 'no-cabe' }
  return layout(profile, copies, uniformMargins(SHEET_MARGIN_MM))
}
