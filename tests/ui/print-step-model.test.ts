import { describe, expect, it } from 'vitest'
import { clampMargin, maxMarginMm, previewDescription, sheetLayout } from '../../src/ui/print-step-model.ts'
import { createSessionStore } from '../../src/ui/session-store.ts'

describe('print-step-model margins', () => {
  it('clamps margins to 5–20 mm', () => {
    expect([clampMargin(2), clampMargin(40), clampMargin(12.4), clampMargin(NaN)]).toEqual([5, 20, 12, 10])
  })

  it('finds the largest margin where the DNI copies fit', () => {
    expect(maxMarginMm('dni-ar', 2)).toBe(16)
    expect(sheetLayout('dni-ar', 2, 16).ok).toBe(true)
    expect(sheetLayout('dni-ar', 2, 17)).toEqual({ ok: false, reason: 'no-cabe' })
  })

  it('describes the preview with copies, filter and watermark', () => {
    expect(previewDescription(2, 'bn', true)).toBe('Hoja A4 con 2 copias de frente y dorso, en blanco y negro, con marca de agua')
    expect(previewDescription(1, 'color', false)).toBe('Hoja A4 con 1 copia de frente y dorso, en color')
  })

  it('store keeps the margin as input, clamps it and resets on clearSession', () => {
    const s = createSessionStore({ revokeUrl: () => {} })
    expect(s.getState().marginMm).toBe(10)
    s.getState().setMarginMm(99)
    expect(s.getState().marginMm).toBe(20)
    s.getState().setMarginMm(7)
    expect(s.getState().marginMm).toBe(7)
    s.getState().clearSession()
    expect(s.getState().marginMm).toBe(10)
  })
})
