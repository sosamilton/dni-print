import { describe, expect, it } from 'vitest'
import { refineQuad } from '../../src/core/geometry/index.ts'
import type { PixelImage, Quad } from '../../src/core/geometry/types.ts'
import { makeScene, meanCornerError, perturb } from './card-scene.ts'

const W = 720
const H = 480
const truth: Quad = [
  { x: 60, y: 50 },
  { x: 660, y: 50 },
  { x: 660, y: 430 },
  { x: 60, y: 430 },
]
const trapezoid: Quad = [
  { x: 110.3, y: 60.7 },
  { x: 610.6, y: 75.2 },
  { x: 670.1, y: 420.4 },
  { x: 45.8, y: 400.9 },
]

function expectImproves(image: PixelImage, truthQuad: Quad, maxError?: number) {
  const start = perturb(truthQuad, 6)
  const before = meanCornerError(start, truthQuad)
  const refined = refineQuad(image, start)
  expect(refined).not.toBe(start)
  const after = meanCornerError(refined, truthQuad)
  expect(after).toBeLessThan(before)
  if (maxError !== undefined) expect(after).toBeLessThan(maxError)
}

describe('refineQuad', () => {
  it('snaps a perturbed quad to a rounded card', () => {
    expectImproves(makeScene({ width: W, height: H, corners: truth }), truth, 1.5)
  })

  it('handles a card in perspective', () => {
    expectImproves(makeScene({ width: W, height: H, corners: trapezoid }), trapezoid, 1.5)
  })

  it('handles a darker card on a lighter background', () => {
    expectImproves(makeScene({ width: W, height: H, corners: truth, card: 40, background: 200 }), truth, 1.5)
  })

  it('tolerates noise', () => {
    expectImproves(makeScene({ width: W, height: H, corners: truth, noise: 25 }), truth)
  })

  it('discards a partial occlusion of one side', () => {
    // A light object covering ~30 % of the top edge, sticking out 6 px above it.
    const occluders = [{ x0: 260, y0: 44, x1: 440, y1: 80, value: 200 }]
    expectImproves(makeScene({ width: W, height: H, corners: truth, occluders }), truth)
  })

  it('finds the card edge behind a cast shadow that the detection took as part of the card', () => {
    // 20 px shadow band glued to the left side, darker than both the background (120) and the card (220).
    const occluders = [{ x0: 40, y0: 50, x1: 60, y1: 430, value: 10 }]
    const image = makeScene({ width: W, height: H, corners: truth, background: 120, occluders })
    const withShadow: Quad = [
      { x: 40, y: 50 },
      truth[1],
      truth[2],
      { x: 40, y: 430 },
    ]
    const refined = refineQuad(image, withShadow)
    expect(refined).not.toBe(withShadow)
    expect(meanCornerError(refined, truth)).toBeLessThan(1.5)
  })

  it('does not mistake the card for a shadow when it sits on a darker background', () => {
    const image = makeScene({ width: W, height: H, corners: truth, background: 120 })
    const start = perturb(truth, 6)
    const refined = refineQuad(image, start)
    expect(meanCornerError(refined, truth)).toBeLessThan(1.5)
  })

  it('returns the same quad on a flat image', () => {
    const flat = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(128) }
    const q = perturb(truth, 6)
    expect(refineQuad(flat, q)).toBe(q)
  })

  it('returns the same quad when the real edge is beyond the cap', () => {
    const image = makeScene({ width: W, height: H, corners: truth })
    const shifted = truth.map((p) => ({ x: p.x + 40, y: p.y + 35 })) as Quad
    expect(refineQuad(image, shifted)).toBe(shifted)
  })

  it('returns the same quad when edges are found but a corner would move beyond the cap', () => {
    // Parallelogram with a 20° angle: sliding along the top side keeps each side within the
    // search strip (normal offset of the slanted sides = 37.5·sin 20° ≈ 12.8 px < H = 15 px)
    // while every corner would move 37.5 px > 2H = 30 px.
    const v = { x: 600 * Math.cos((20 * Math.PI) / 180), y: 600 * Math.sin((20 * Math.PI) / 180) }
    const para: Quad = [
      { x: 60, y: 60 },
      { x: 560, y: 60 },
      { x: 560 + v.x, y: 60 + v.y },
      { x: 60 + v.x, y: 60 + v.y },
    ]
    const image = makeScene({ width: 1240, height: 330, corners: para, supersample: 2 })
    const start = para.map((p) => ({ x: p.x + 37.5, y: p.y })) as Quad
    expect(refineQuad(image, start)).toBe(start)
  })

  it('returns the same quad on invalid input without throwing', () => {
    const image = makeScene({ width: 64, height: 48, corners: [
      { x: 8, y: 8 }, { x: 56, y: 8 }, { x: 56, y: 40 }, { x: 8, y: 40 },
    ] })
    const bad = [truth[0], truth[0], truth[0], truth[0]] as Quad
    expect(refineQuad(image, bad)).toBe(bad)
    const q = perturb(truth, 6)
    expect(refineQuad({ width: W, height: H, data: new Uint8ClampedArray(10) }, q)).toBe(q)
    expect(refineQuad(null as never, q)).toBe(q)
    expect(refineQuad(image, null as never)).toBe(null)
  })

  it('is deterministic and does not mutate its inputs', () => {
    const image = makeScene({ width: W, height: H, corners: truth, noise: 25 })
    const dataCopy = new Uint8ClampedArray(image.data)
    const q = perturb(truth, 6)
    const qCopy = structuredClone(q)
    const a = refineQuad(image, q)
    const b = refineQuad(image, q)
    expect(a).toEqual(b)
    expect(q).toEqual(qCopy)
    expect(image.data).toEqual(dataCopy)
  })
})
