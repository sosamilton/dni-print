import { describe, expect, it } from 'vitest'
import { GAP_MM, MIN_MARGIN_MM, ROW_GAP_MM, getProfile, layout, uniformMargins } from '../../src/core/index.ts'

const dni = getProfile('dni-ar')!
const m10 = uniformMargins(10)

describe('layout', () => {
  it('places 2 copies: front left, back right, centered, top aligned', () => {
    const r = layout(dni, 2, m10)
    if (!r.ok) throw new Error('expected ok')
    expect(r.placements).toHaveLength(4)
    const leftMm = (210 - (2 * 85.6 + GAP_MM)) / 2
    const [f1, b1, f2, b2] = r.placements
    expect([f1.face, b1.face, f2.face, b2.face]).toEqual(['front', 'back', 'front', 'back'])
    expect(f1.xMm).toBeCloseTo(leftMm)
    expect(b1.xMm).toBeCloseTo(leftMm + 85.6 + GAP_MM)
    expect(f1.yMm).toBe(10)
    expect(f2.yMm).toBeCloseTo(10 + 54 + ROW_GAP_MM)
    for (const p of r.placements) expect([p.widthMm, p.heightMm]).toEqual([85.6, 54])
    // ruler: 100 mm, horizontally centered, in the strip under the last row
    expect(r.ruler.lengthMm).toBe(100)
    expect(r.ruler.xMm).toBeCloseTo(55)
    const blockBottom = 10 + 118
    expect(r.ruler.yMm).toBeCloseTo((blockBottom + 287) / 2)
  })

  it('places 1 copy', () => {
    const r = layout(dni, 1, m10)
    if (!r.ok) throw new Error('expected ok')
    expect(r.placements.map((p) => p.face)).toEqual(['front', 'back'])
    expect(r.ruler.yMm).toBeCloseTo((10 + 54 + 287) / 2)
  })

  it('rejects margins below the minimum', () => {
    expect(layout(dni, 1, uniformMargins(MIN_MARGIN_MM - 0.1))).toEqual({ ok: false, reason: 'margen-invalido' })
    expect(layout(dni, 1, { ...m10, leftMm: 4 })).toEqual({ ok: false, reason: 'margen-invalido' })
    expect(layout(dni, 1, { ...m10, topMm: Number.NaN })).toEqual({ ok: false, reason: 'margen-invalido' })
    expect(layout(dni, 2, uniformMargins(MIN_MARGIN_MM)).ok).toBe(true)
  })

  it('reports no-cabe when copies or the ruler do not fit', () => {
    expect(layout(dni, 2, uniformMargins(17))).toEqual({ ok: false, reason: 'no-cabe' }) // width 176.2 > 176
    expect(layout(dni, 2, { ...m10, bottomMm: 160 })).toEqual({ ok: false, reason: 'no-cabe' })
    expect(layout(dni, 1, { ...m10, leftMm: 60, rightMm: 60 })).toEqual({ ok: false, reason: 'no-cabe' })
  })
})
