import { describe, expect, it } from 'vitest'
import { A4_HEIGHT_MM, GAP_MM, MIN_MARGIN_MM, getProfile, layout, uniformMargins } from '../../src/core/index.ts'

const dni = getProfile('dni-ar')!
const m10 = uniformMargins(10)

describe('layout', () => {
  it('places 2 copies: front left, back right, each copy centered in its half of the sheet', () => {
    const r = layout(dni, 2, m10)
    if (!r.ok) throw new Error('expected ok')
    expect(r.placements).toHaveLength(4)
    const leftMm = (210 - (2 * 85.6 + GAP_MM)) / 2
    const [f1, b1, f2, b2] = r.placements
    expect([f1.face, b1.face, f2.face, b2.face]).toEqual(['front', 'back', 'front', 'back'])
    expect([f1.copy, b1.copy, f2.copy, b2.copy]).toEqual([0, 0, 1, 1])
    expect(f1.xMm).toBeCloseTo(leftMm)
    expect(b1.xMm).toBeCloseTo(leftMm + 85.6 + GAP_MM)
    expect(f2.xMm).toBeCloseTo(leftMm)
    expect(f1.yMm).toBeCloseTo(47.25)
    expect(b1.yMm).toBeCloseTo(47.25)
    expect(f2.yMm).toBeCloseTo(195.75)
    expect(b2.yMm).toBeCloseTo(195.75)
    for (const p of r.placements) expect([p.widthMm, p.heightMm]).toEqual([85.6, 54])
    expect(r.cutLine).toEqual({ yMm: 148.5, x1Mm: 10, x2Mm: 200 })
    // ruler: 100 mm, horizontally centered, in the strip under copy 1
    expect(r.ruler.lengthMm).toBe(100)
    expect(r.ruler.xMm).toBeCloseTo(55)
    expect(r.ruler.yMm).toBeCloseTo((249.75 + 287) / 2)
  })

  it.each([5, 10, 16])('keeps every face and the ruler (with its label) off the cut line and inside margins: %d mm', (m) => {
    const r = layout(dni, 2, uniformMargins(m))
    if (!r.ok || !r.cutLine) throw new Error('expected ok')
    const cut = r.cutLine.yMm
    expect(cut).toBe(A4_HEIGHT_MM / 2)
    expect(r.cutLine.x1Mm).toBe(m)
    expect(r.cutLine.x2Mm).toBe(210 - m)
    for (const p of r.placements) {
      const half = p.copy === 0 ? [0, cut] : [cut, A4_HEIGHT_MM]
      expect(p.yMm).toBeGreaterThanOrEqual(Math.max(half[0], m))
      expect(p.yMm + p.heightMm).toBeLessThanOrEqual(Math.min(half[1], A4_HEIGHT_MM - m))
      expect(p.xMm).toBeGreaterThanOrEqual(m)
      expect(p.xMm + p.widthMm).toBeLessThanOrEqual(210 - m)
    }
    expect(r.placements.filter((p) => p.copy === 0).every((p) => p.yMm === 47.25)).toBe(true)
    expect(r.placements.filter((p) => p.copy === 1).every((p) => p.yMm === 195.75)).toBe(true)
    // ruler label sits ~6 mm above the line, ticks 2 mm below; all in the lower half, under copy 1
    expect(r.ruler.yMm - 6).toBeGreaterThan(195.75 + 54)
    expect(r.ruler.yMm + 2).toBeLessThanOrEqual(A4_HEIGHT_MM - m)
    expect(r.ruler.yMm).toBeCloseTo((249.75 + A4_HEIGHT_MM - m) / 2)
    expect(r.ruler.xMm).toBeGreaterThanOrEqual(m)
  })

  it('moves copy 0 down as little as the top margin requires, still in its half', () => {
    const r = layout(dni, 2, { ...m10, topMm: 60 })
    if (!r.ok) throw new Error('expected ok')
    const top = r.placements.filter((p) => p.copy === 0)
    expect(top.every((p) => p.yMm === 60 && p.yMm + p.heightMm <= 148.5)).toBe(true)
    expect(r.placements.filter((p) => p.copy === 1).every((p) => p.yMm === 195.75)).toBe(true)
  })

  it('moves copy 1 up as little as the bottom margin and ruler strip require, still in its half', () => {
    const r = layout(dni, 2, { ...m10, bottomMm: 60 })
    if (!r.ok) throw new Error('expected ok')
    expect(r.placements.filter((p) => p.copy === 1).every((p) => p.yMm === 171)).toBe(true)
    expect(r.ruler.yMm + 2).toBeLessThanOrEqual(297 - 60)
    expect(r.ruler.yMm - 6).toBeGreaterThanOrEqual(171 + 54)
  })

  it('reports no-cabe when a copy or the ruler does not fit in its half', () => {
    expect(layout(dni, 2, { ...m10, topMm: 100 })).toEqual({ ok: false, reason: 'no-cabe' })
    expect(layout(dni, 2, { ...m10, bottomMm: 90 })).toEqual({ ok: false, reason: 'no-cabe' })
  })

  it('places 1 copy as always, with no cut line', () => {
    const r = layout(dni, 1, m10)
    if (!r.ok) throw new Error('expected ok')
    const leftMm = (210 - (2 * 85.6 + GAP_MM)) / 2
    expect(r.placements).toEqual([
      { face: 'front', copy: 0, xMm: leftMm, yMm: 10, widthMm: 85.6, heightMm: 54 },
      { face: 'back', copy: 0, xMm: leftMm + 85.6 + GAP_MM, yMm: 10, widthMm: 85.6, heightMm: 54 },
    ])
    expect(r.ruler.xMm).toBeCloseTo(55)
    expect(r.ruler.yMm).toBeCloseTo((10 + 54 + 287) / 2)
    expect(r.cutLine).toBeNull()
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
