import { describe, expect, it } from 'vitest'
import { clampMargin, maxMarginMm, pdfInputsKey, previewDescription, sheetLayout } from '../../src/ui/print-step-model.ts'
import type { PdfInputs } from '../../src/ui/print-step-model.ts'
import type { Quad, Rotation } from '../../src/core/index.ts'
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

describe('pdfInputsKey', () => {
  const quad = (o: number): Quad => [
    { x: o, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 60 },
    { x: 0, y: 60 },
  ]
  const face = (o = 0, rotation: Rotation = 0) => ({ quad: quad(o), rotation, rev: 1, rendered: null })
  const base: PdfInputs = {
    copies: 2,
    profileId: 'dni-ar',
    filter: 'color',
    watermarkOn: false,
    watermarkText: '',
    marginMm: 10,
    faces: { front: face(), back: face() },
  }
  const key = pdfInputsKey(base)

  it('changes with every input the PDF is built from', () => {
    const variants: PdfInputs[] = [
      { ...base, copies: 1 },
      { ...base, profileId: 'otro' },
      { ...base, filter: 'bn' },
      { ...base, watermarkOn: true, watermarkText: 'Copia' },
      { ...base, marginMm: 12 },
      { ...base, faces: { ...base.faces, front: face(5) } },
      { ...base, faces: { ...base.faces, back: face(0, 90) } },
      { ...base, faces: { front: base.faces.front } },
    ]
    for (const v of variants) expect(pdfInputsKey(v)).not.toBe(key)
  })

  it('ignores renders, revisions and a watermark that is off or blank', () => {
    const rerendered = { ...face(), rev: 9, rendered: {} }
    expect(pdfInputsKey({ ...base, faces: { front: rerendered, back: rerendered } } as PdfInputs)).toBe(key)
    expect(pdfInputsKey({ ...base, watermarkText: 'Copia' })).toBe(key)
    expect(pdfInputsKey({ ...base, watermarkOn: true, watermarkText: '   ' })).toBe(key)
  })
})
