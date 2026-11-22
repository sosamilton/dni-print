import { describe, expect, it } from 'vitest'
import { bottomHeaviness, chooseRotation, getProfile, quadAxis } from '../../src/core/index.ts'
import type { PixelImage, Quad, Rotation } from '../../src/core/index.ts'

const profile = getProfile('dni-ar')!

/** Upright synthetic face: sparse "header" bars on top, dense text-like bars and a barcode at the bottom. */
function face(width: number, height: number, layout: 'bottom-heavy' | 'blank' | 'photo-left'): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  const unit = Math.max(2, Math.round(width / 160))
  const put = (x: number, y: number, v: number) => {
    const i = (y * width + x) * 4
    data[i] = data[i + 1] = data[i + 2] = v
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 225
      const fy = y / height
      const fx = x / width
      if (layout !== 'blank') {
        if (layout === 'photo-left' && fx > 0.05 && fx < 0.3 && fy > 0.2 && fy < 0.8) v = (Math.floor(x / (unit * 3)) + Math.floor(y / (unit * 3))) % 2 ? 60 : 160
        // Sparse header text on top: one thin line.
        else if (fy > 0.05 && fy < 0.1 && fx > 0.3 && Math.floor(x / unit) % 3 === 0) v = 40
        // Dense text lines and barcode on the bottom third.
        else if (fy > 0.72 && fy < 0.95 && Math.floor(y / (unit * 3)) % 2 === 0 && Math.floor(x / unit) % 2 === 0) v = 30
      }
      put(x, y, v)
    }
  }
  return { width, height, data }
}

/** Rotates the image `cw` degrees clockwise (what turning the phone does to the picture). */
function turn(img: PixelImage, cw: 0 | 90 | 180 | 270): PixelImage {
  const { width: w, height: h } = img
  const [nw, nh] = cw === 90 || cw === 270 ? [h, w] : [w, h]
  const out = new Uint8ClampedArray(nw * nh * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [nx, ny] = cw === 0 ? [x, y] : cw === 90 ? [h - 1 - y, x] : cw === 180 ? [w - 1 - x, h - 1 - y] : [y, w - 1 - x]
      out.set(img.data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (ny * nw + nx) * 4)
    }
  }
  return { width: nw, height: nh, data: out }
}

const full = (img: PixelImage): Quad => [
  { x: 2, y: 2 },
  { x: img.width - 2, y: 2 },
  { x: img.width - 2, y: img.height - 2 },
  { x: 2, y: img.height - 2 },
]

describe('chooseRotation', () => {
  const upright = face(480, 300, 'bottom-heavy')

  // Turning the picture `cw` clockwise needs `(360 - cw) % 360` to bring it back (corpus convention: top on the right -> 270).
  for (const cw of [0, 90, 180, 270] as const) {
    const expected = ((360 - cw) % 360) as Rotation
    it(`face turned ${cw}° clockwise -> rotation ${expected}`, () => {
      const img = turn(upright, cw)
      expect(chooseRotation(img, full(img), profile)).toEqual({ rotation: expected, decidedBy: 'content' })
    })
  }

  it('also reads a face with the photo block on one side', () => {
    const img = turn(face(480, 300, 'photo-left'), 180)
    expect(chooseRotation(img, full(img), profile).rotation).toBe(180)
  })

  it('a tilted (perspective) quad on the same axis keeps the decision', () => {
    const img = upright
    const quad: Quad = [{ x: 30, y: 10 }, { x: 460, y: 30 }, { x: 450, y: 285 }, { x: 20, y: 270 }]
    expect(chooseRotation(img, quad, profile).rotation).toBe(0)
  })

  it('a blank face keeps the rotation the shape gives, without inventing a sense', () => {
    const landscape = face(480, 300, 'blank')
    expect(chooseRotation(landscape, full(landscape), profile)).toEqual({ rotation: 0, decidedBy: 'axis' })
    const portrait = turn(landscape, 90)
    expect(chooseRotation(portrait, full(portrait), profile)).toEqual({ rotation: 270, decidedBy: 'axis' })
  })

  it('a near-square quad gives 0 even with content', () => {
    const sq = face(300, 280, 'bottom-heavy')
    expect(chooseRotation(turn(sq, 180), full(turn(sq, 180)), profile)).toEqual({ rotation: 0, decidedBy: 'axis' })
  })

  it('an invalid quad or malformed image never throws', () => {
    const bad: Quad = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]
    expect(chooseRotation(upright, bad, profile).rotation).toBe(0)
    expect(chooseRotation({ width: 5, height: 5, data: new Uint8ClampedArray(3) }, full(upright), profile).decidedBy).toBe('axis')
  })
})

describe('quadAxis', () => {
  const rect = (w: number, h: number): Quad => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]
  it('uses the ratio of the sides with a margin', () => {
    expect(quadAxis(rect(158, 100))).toBe('horizontal')
    expect(quadAxis(rect(100, 158))).toBe('vertical')
    expect(quadAxis(rect(110, 100))).toBeNull()
    expect(quadAxis(rect(0, 0))).toBeNull()
  })
})

describe('bottomHeaviness', () => {
  it('is ~0 on a flat image and positive when the ink is at the bottom', () => {
    expect(Math.abs(bottomHeaviness(face(160, 100, 'blank')))).toBeLessThan(0.01)
    expect(bottomHeaviness(face(160, 100, 'bottom-heavy'))).toBeGreaterThan(0.3)
  })
})
