import { describe, expect, it } from 'vitest'
import { CARD_ASPECT, cardCandidates, findCardQuad, orderCorners, shapeScore } from '../../src/core/geometry/card-fit.ts'
import type { Quad } from '../../src/core/geometry/types.ts'
import { makeScene, meanCornerError } from './card-scene.ts'

const W = 640
const H = 480
const q = (pts: [number, number][]): Quad => pts.map(([x, y]) => ({ x, y })) as Quad
/** Card-shaped rectangle (ratio 1.6) rotated by `deg` around (320, 240), TL, TR, BR, BL. */
const rotated = (deg: number): Quad => {
  const a = (deg * Math.PI) / 180
  const pt = (x: number, y: number): [number, number] => [320 + x * Math.cos(a) - y * Math.sin(a), 240 + x * Math.sin(a) + y * Math.cos(a)]
  return q([pt(-160, -100), pt(160, -100), pt(160, 100), pt(-160, 100)])
}
const TRUE_RECT = q([[160, 140], [480, 140], [480, 340], [160, 340]]) // ratio 1.6

describe('shapeScore', () => {
  it('likes a card and dislikes a sheet or a square', () => {
    expect(shapeScore(TRUE_RECT, CARD_ASPECT)).toBeGreaterThan(0.9)
    expect(shapeScore(q([[0, 0], [297, 0], [297, 210], [0, 210]]), CARD_ASPECT)).toBeLessThan(0.6) // A4 (1.41): a card-shaped doubt, not a card
    expect(shapeScore(q([[0, 0], [200, 0], [200, 200], [0, 200]]), CARD_ASPECT)).toBeLessThan(0.05)
  })
  it('works with the long side vertical', () => {
    expect(shapeScore(q([[160, 100], [360, 100], [360, 420], [160, 420]]), CARD_ASPECT)).toBeGreaterThan(0.9)
  })
  it('rejects a trapezoid with very uneven opposite sides', () => {
    expect(shapeScore(q([[100, 100], [200, 100], [400, 300], [0, 300]]), CARD_ASPECT)).toBe(0)
  })
})

describe('orderCorners', () => {
  it('orders clockwise from the corner nearest the top-left, even near 45°', () => {
    const diamond = [{ x: 110, y: 0 }, { x: 200, y: 100 }, { x: 90, y: 200 }, { x: 0, y: 100 }]
    const out = orderCorners([diamond[2], diamond[0], diamond[3], diamond[1]])
    expect(out).toEqual([diamond[3], diamond[0], diamond[1], diamond[2]])
  })
})

describe('findCardQuad on synthetic scenes', () => {
  it('finds a plain rectangle within a couple of px', () => {
    const img = makeScene({ width: W, height: H, corners: TRUE_RECT })
    const found = findCardQuad(img)
    expect(found).not.toBeNull()
    expect(meanCornerError(found!, TRUE_RECT)).toBeLessThan(4)
  })

  it('finds a card seen with perspective', () => {
    const corners = q([[170, 120], [500, 150], [470, 350], [150, 330]])
    const found = findCardQuad(makeScene({ width: W, height: H, corners }))
    expect(found).not.toBeNull()
    expect(meanCornerError(found!, corners)).toBeLessThan(6)
  })

  it('finds a rotated card with rounded corners and noise', () => {
    for (const deg of [25, -40, 90]) {
      const corners = orderCorners(rotated(deg))
      const found = findCardQuad(makeScene({ width: W, height: H, corners, radius: 0.06, noise: 6 }))
      expect(found, `${deg}°`).not.toBeNull()
      expect(meanCornerError(found!, corners), `${deg}°`).toBeLessThan(8)
    }
  })

  it('finds a card that is lighter-on-dark or darker-on-light alike', () => {
    const found = findCardQuad(makeScene({ width: W, height: H, corners: TRUE_RECT, card: 40, background: 210 }))
    expect(found).not.toBeNull()
    expect(meanCornerError(found!, TRUE_RECT)).toBeLessThan(4)
  })

  it('prefers the card over a sheet that holds it (A4 ratio)', () => {
    // Sheet = whole frame minus a margin, brighter than the table; the card sits on it, darker.
    const sheet = makeScene({ width: W, height: H, corners: q([[30, 40], [610, 40], [610, 440], [30, 440]]), cardWidth: 580, cardHeight: 400, radius: 0, card: 235, background: 40 })
    const card = makeScene({ width: W, height: H, corners: TRUE_RECT, card: 120, background: 0 })
    for (let i = 0; i < sheet.data.length; i += 4) {
      if (card.data[i] > 60) sheet.data[i] = sheet.data[i + 1] = sheet.data[i + 2] = card.data[i]
    }
    const found = findCardQuad(sheet)
    expect(found).not.toBeNull()
    expect(meanCornerError(found!, TRUE_RECT)).toBeLessThan(6)
  })

  it('does not return the card plus a finger (a candidate that bulges the shape)', () => {
    // A finger-like block glued to the short side: the lines still fit the card, never the bulge.
    const corners = TRUE_RECT
    const img = makeScene({ width: W, height: H, corners, occluders: [{ x0: 440, y0: 200, x1: 540, y1: 250, value: 220 }] })
    const found = findCardQuad(img)
    expect(found).not.toBeNull()
    expect(meanCornerError(found!, TRUE_RECT)).toBeLessThan(6)
  })

  it('returns null for a flat image and for noise', () => {
    const flat = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(128) }
    expect(findCardQuad(flat)).toBeNull()
    const noisy = makeScene({ width: W, height: H, corners: TRUE_RECT, card: 100, background: 100, noise: 40 })
    expect(findCardQuad(noisy)).toBeNull()
  })

  it('returns null for malformed input without throwing', () => {
    expect(findCardQuad({ width: 4, height: 4, data: new Uint8ClampedArray(64) })).toBeNull()
    expect(findCardQuad({ width: 100, height: 100, data: new Uint8ClampedArray(10) })).toBeNull()
  })

  it('is deterministic and ranks the card first', () => {
    const img = makeScene({ width: W, height: H, corners: TRUE_RECT })
    const a = cardCandidates(img)
    const b = cardCandidates(img)
    expect(a.length).toBeGreaterThan(0)
    expect(b).toEqual(a)
    expect(a[0].score).toBeGreaterThanOrEqual(a[a.length - 1].score)
  })
})
