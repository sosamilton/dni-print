import { describe, expect, it } from 'vitest'
import {
  applyHomography,
  rectify,
  solveHomography,
  type PixelImage,
  type Quad,
} from '../../src/core/geometry/index.ts'
import { getProfile } from '../../src/core/profiles.ts'

const profile = getProfile('dni-ar')!
const W = 1011
const H = 638

// Synthetic photo: gradient pattern R=u/W, G=v/H seen through a known perspective quad.
const quad: Quad = [
  { x: 120, y: 90 },
  { x: 690, y: 130 },
  { x: 660, y: 470 },
  { x: 100, y: 500 },
]

function makeSource(): PixelImage {
  const width = 800
  const height = 600
  const data = new Uint8ClampedArray(width * height * 4)
  const toRect = solveHomography(quad, [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ])!
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { x: u, y: v } = applyHomography(toRect, x + 0.5, y + 0.5)
      const o = (y * width + x) * 4
      const inside = u >= 0 && u <= W && v >= 0 && v <= H
      data[o] = inside ? (u / W) * 255 : 40
      data[o + 1] = inside ? (v / H) * 255 : 40
      data[o + 2] = inside ? 128 : 40
      data[o + 3] = 255
    }
  }
  return { width, height, data }
}

function px(img: PixelImage, x: number, y: number) {
  const o = (y * img.width + x) * 4
  return [img.data[o], img.data[o + 1], img.data[o + 2]]
}

function makeRampSource(uc: number, vc: number): PixelImage {
  const width = 800
  const height = 600
  const data = new Uint8ClampedArray(width * height * 4)
  const toRect = solveHomography(quad, [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ])!
  const slope = 16 // gray levels per output px
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { x: u, y: v } = applyHomography(toRect, x + 0.5, y + 0.5)
      const o = (y * width + x) * 4
      data[o] = Math.min(255, Math.max(0, 127.5 + (uc - u) * slope))
      data[o + 1] = Math.min(255, Math.max(0, 127.5 + (vc - v) * slope))
      data[o + 2] = 0
      data[o + 3] = 255
    }
  }
  return { width, height, data }
}

/** Continuous coordinate (pixel centers at i + 0.5) where the descending ramp crosses 127.5. */
function crossing(sample: (i: number) => number, n: number): number {
  for (let i = 0; i < n - 1; i++) {
    const a = sample(i)
    const b = sample(i + 1)
    if (a >= 127.5 && b < 127.5) return i + 0.5 + (a - 127.5) / (a - b)
  }
  return NaN
}

describe('rectify', () => {
  const src = makeSource()

  it('outputs 1011x638 with corners and grid within 1 px', () => {
    const out = rectify(src, quad, 0, profile)!
    expect(out.width).toBe(W)
    expect(out.height).toBe(H)
    expect(out.data.length).toBe(W * H * 4)
    const tol = 255 / W + 4 // one px of gradient plus quantization/bilinear slack
    for (const gx of [20, 250, 505, 760, 990]) {
      for (const gy of [20, 160, 320, 480, 620]) {
        const [r, g] = px(out, gx, gy)
        expect(Math.abs(r - ((gx + 0.5) / W) * 255)).toBeLessThanOrEqual(tol)
        expect(Math.abs(g - ((gy + 0.5) / H) * 255)).toBeLessThanOrEqual(tol * 1.6)
      }
    }
    expect(px(out, 3, 3)[0]).toBeLessThan(10)
    expect(px(out, W - 4, H - 4)[0]).toBeGreaterThan(245)
  })

  it('rotation 180 turns content and keeps size', () => {
    const a = rectify(src, quad, 0, profile)!
    const b = rectify(src, quad, 180, profile)!
    expect(b.width).toBe(W)
    expect(b.height).toBe(H)
    const [r0] = px(a, 100, 100)
    const [r1] = px(b, W - 1 - 100, H - 1 - 100)
    expect(Math.abs(r0 - r1)).toBeLessThanOrEqual(3)
  })

  it('puts ramp edges within 1 px of their expected position', () => {
    // Soft edge (8 px wide in output space) so the 0.5 crossing is measurable to sub-pixel.
    for (const [uc, vc] of [[W / 4, H / 4], [(3 * W) / 4, (3 * H) / 4]]) {
      const img = makeRampSource(uc, vc)
      const out = rectify(img, quad, 0, profile)!
      const row = Math.round(H / 2)
      const col = Math.round(W / 2)
      expect(Math.abs(crossing((i) => px(out, i, row)[0], W) - uc)).toBeLessThanOrEqual(1)
      expect(Math.abs(crossing((i) => px(out, col, i)[1], H) - vc)).toBeLessThanOrEqual(1)
    }
  })

  it('rotation 90 and 270 map the oriented corners (cyclic shift)', () => {
    const a = rectify(src, quad, 90, profile)!
    // TL' = old BL (R 0, G 255); BR' = old TR (R 255, G 0).
    expect(px(a, 3, 3)[0]).toBeLessThan(10)
    expect(px(a, 3, 3)[1]).toBeGreaterThan(245)
    expect(px(a, W - 4, H - 4)[0]).toBeGreaterThan(245)
    expect(px(a, W - 4, H - 4)[1]).toBeLessThan(10)
    const b = rectify(src, quad, 270, profile)!
    expect(b.width).toBe(W)
    expect(b.height).toBe(H)
    // TL' = old TR (R 255, G 0); BR' = old BL (R 0, G 255).
    expect(px(b, 3, 3)[0]).toBeGreaterThan(245)
    expect(px(b, 3, 3)[1]).toBeLessThan(10)
    expect(px(b, W - 4, H - 4)[0]).toBeLessThan(10)
    expect(px(b, W - 4, H - 4)[1]).toBeGreaterThan(245)
  })

  it('prefilters with a perspective quad on a size not divisible by the factor', () => {
    const width = 2999
    const height = 1999
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = 100 + Math.round((x / width) * 100)
        data.set([v, v, v, 255], (y * width + x) * 4)
      }
    }
    const q: Quad = [
      { x: 100, y: 100 },
      { x: 2900, y: 150 },
      { x: 2850, y: 1900 },
      { x: 120, y: 1850 },
    ]
    const out = rectify({ width, height, data }, q, 0, profile)!
    // Horizontal gradient: left edge ~ x 110 -> 103; right edge ~ x 2875 -> 196.
    expect(px(out, 5, H / 2)[0]).toBeGreaterThan(100)
    expect(px(out, 5, H / 2)[0]).toBeLessThan(108)
    expect(px(out, W - 6, H / 2)[0]).toBeGreaterThan(190)
    expect(px(out, W - 6, H / 2)[0]).toBeLessThan(200)
  })

  it('prefilters when reducing more than 2x (no moire)', () => {
    const width = 3000
    const height = 1000
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = x % 2 === 0 ? 0 : 255
        data.set([v, v, v, 255], (y * width + x) * 4)
      }
    }
    const full: Quad = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ]
    const out = rectify({ width, height, data }, full, 0, profile)!
    for (const [x, y] of [[50, 50], [500, 300], [900, 600]]) {
      expect(Math.abs(px(out, x, y)[0] - 127.5)).toBeLessThanOrEqual(2)
    }
  })

  it('returns null on invalid input', () => {
    const bow: Quad = [quad[0], quad[2], quad[1], quad[3]]
    expect(rectify(src, bow, 0, profile)).toBeNull()
    expect(rectify(src, quad, 45, profile)).toBeNull()
    expect(rectify({ width: 0, height: 0, data: new Uint8ClampedArray(0) }, quad, 0, profile)).toBeNull()
    expect(rectify({ width: 10, height: 10, data: new Uint8ClampedArray(5) }, quad, 0, profile)).toBeNull()
  })
})
