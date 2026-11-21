import { describe, expect, it } from 'vitest'
import { BLUR_THRESHOLD, isBlurry, measureSharpness, SHARPNESS_WIDTH_PX } from '../../src/core/index.ts'
import type { PixelImage } from '../../src/core/index.ts'
import { blurScene, textScene } from './text-scene.ts'

const solid = (width: number, height: number, v = 128): PixelImage => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4).fill(v),
})

describe('measureSharpness', () => {
  const sharp = textScene(1011, 638)
  const blurred = blurScene(sharp, 4, 3)

  it('separates a sharp scene from the same scene blurred', () => {
    const s = measureSharpness(sharp)!
    const b = measureSharpness(blurred)!
    expect(s).toBeGreaterThan(BLUR_THRESHOLD)
    expect(b).toBeLessThan(BLUR_THRESHOLD)
    expect(isBlurry(s)).toBe(false)
    expect(isBlurry(b)).toBe(true)
  })

  it('gives 0 for a single-color image', () => {
    expect(measureSharpness(solid(1011, 638))).toBe(0)
    expect(measureSharpness(solid(40, 30, 7))).toBe(0)
  })

  it('returns null for invalid images without throwing', () => {
    expect(measureSharpness({ width: 10, height: 10, data: new Uint8ClampedArray(12) })).toBeNull()
    expect(measureSharpness({ width: 0, height: 10, data: new Uint8ClampedArray(0) })).toBeNull()
    expect(measureSharpness(null as never)).toBeNull()
    expect(isBlurry(null)).toBe(false)
  })

  it('measures images narrower than the fixed width without upscaling', () => {
    const small = textScene(300, 190)
    expect(small.width).toBeLessThan(SHARPNESS_WIDTH_PX)
    // A 2x nearest-neighbour upscale would halve the Laplacian's response; a native measure keeps it high.
    expect(measureSharpness(small)!).toBeGreaterThan(BLUR_THRESHOLD)
    // Columns only differ in the interior: an upscaled copy would yield a different value.
    const stripes: PixelImage = solid(4, 3, 0)
    for (let y = 0; y < 3; y++) for (let c = 0; c < 3; c++) stripes.data[(y * 4 + 1) * 4 + c] = 255
    // White column 1. Interior pixels (1,1) and (2,1): L = −510 and +255 → variance = (510² + 255²)/2 − (255/2)².
    expect(measureSharpness(stripes)).toBeCloseTo((510 ** 2 + 255 ** 2) / 2 - (255 / 2) ** 2, 6)
  })

  it('is deterministic and does not mutate its input', () => {
    const copy = new Uint8ClampedArray(sharp.data)
    const a = measureSharpness(sharp)
    const b = measureSharpness(sharp)
    expect(a).toBe(b)
    expect(sharp.data).toEqual(copy)
  })

  it('exports a conservative threshold and the fixed width', () => {
    expect(SHARPNESS_WIDTH_PX).toBe(512)
    expect(BLUR_THRESHOLD).toBeGreaterThan(0)
  })
})
