import { describe, expect, it } from 'vitest'
import { defaultQuad, orientQuad, validateQuad } from '../../src/core/geometry/index.ts'
import type { Quad } from '../../src/core/geometry/index.ts'

const A = { x: 0, y: 0 }
const B = { x: 10, y: 0 }
const C = { x: 10, y: 5 }
const D = { x: 0, y: 5 }
const q: Quad = [A, B, C, D]

describe('orientQuad', () => {
  it('shifts cyclically', () => {
    expect(orientQuad(q, 0)).toEqual([A, B, C, D])
    expect(orientQuad(q, 90)).toEqual([D, A, B, C])
    expect(orientQuad(q, 180)).toEqual([C, D, A, B])
    expect(orientQuad(q, 270)).toEqual([B, C, D, A])
  })
  it('returns null for invalid rotation', () => {
    expect(orientQuad(q, 45)).toBeNull()
  })
})

describe('validateQuad', () => {
  it('accepts rectangle and convex trapezoid', () => {
    expect(validateQuad(q)).toBe(true)
    expect(validateQuad([{ x: 2, y: 0 }, { x: 8, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }])).toBe(true)
  })
  it('rejects bow-tie, concave and degenerate', () => {
    expect(validateQuad([A, C, B, D])).toBe(false)
    expect(validateQuad([A, B, { x: 1, y: 1 }, D])).toBe(false)
    expect(validateQuad([A, { x: 5, y: 0 }, B, { x: 3, y: 0 }])).toBe(false)
    expect(validateQuad([A, A, C, D])).toBe(false)
    expect(validateQuad([A, B, B, A])).toBe(false)
    expect(validateQuad([A, B, C, { x: NaN, y: 1 }])).toBe(false)
    expect(validateQuad([A, B, C, { x: Infinity, y: 1 }])).toBe(false)
  })
  it('rejects a mirrored (counter-clockwise) order', () => {
    expect(validateQuad([A, D, C, B])).toBe(false)
  })
  it('rejects a convex sliver with non-zero cross products', () => {
    expect(
      validateQuad([
        { x: 0, y: 0 },
        { x: 100, y: 0.001 },
        { x: 100, y: 0.002 },
        { x: 0, y: 0.001 },
      ]),
    ).toBe(false)
  })
})

describe('defaultQuad', () => {
  it('uses a 10 % margin', () => {
    const [tl, tr, br, bl] = defaultQuad(1000, 800)
    expect(tl).toEqual({ x: 100, y: 80 })
    expect(tr).toEqual({ x: 900, y: 80 })
    expect(br).toEqual({ x: 900, y: 720 })
    expect(bl).toEqual({ x: 100, y: 720 })
  })
  it('throws RangeError on bad size', () => {
    expect(() => defaultQuad(0, 10)).toThrow(RangeError)
    expect(() => defaultQuad(10, NaN)).toThrow(RangeError)
  })
})
