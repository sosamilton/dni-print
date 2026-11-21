import { describe, expect, it } from 'vitest'
import { createDetectionEngine } from '../../src/engines/index.ts'
import { createOpenCvEngine, type CvLike } from '../../src/engines/opencv-engine.ts'

const img = { width: 100, height: 80, data: new Uint8ClampedArray(100 * 80 * 4) }

/** Fake cv: every `approxPolyDP` yields `points` (flat x,y list); counts live Mats. */
function fakeCv(points: number[], opts: { area?: number; throwAt?: 'Canny' } = {}) {
  const state = { live: 0, contours: 1 }
  class Mat {
    rows = 0
    data32S = new Int32Array(0)
    constructor() {
      state.live++
    }
    delete() {
      state.live--
    }
    intPtr() {
      return new Int32Array(2)
    }
  }
  const cv = {
    Mat,
    MatVector: class {
      constructor() {
        state.live++
      }
      size() {
        return state.contours
      }
      get() {
        return new Mat()
      }
      delete() {
        state.live--
      }
    },
    Size: class {},
    matFromImageData: () => new Mat(),
    cvtColor() {},
    GaussianBlur() {},
    Canny() {
      if (opts.throwAt === 'Canny') throw new Error('boom')
    },
    dilate() {},
    getStructuringElement: () => new Mat(),
    findContours() {},
    arcLength: () => 100,
    approxPolyDP(_c: unknown, dst: InstanceType<typeof Mat>) {
      dst.rows = points.length / 2
      dst.data32S = Int32Array.from(points)
    },
    isContourConvex: () => true,
    contourArea: () => opts.area ?? 5000,
    COLOR_RGBA2GRAY: 0,
    MORPH_RECT: 0,
    RETR_EXTERNAL: 0,
    CHAIN_APPROX_SIMPLE: 0,
  }
  return { cv: cv as unknown as CvLike, state }
}

const shuffled = [88, 70, 10, 12, 12, 72, 90, 8] // BR, TL, BL, TR

describe('opencv engine', () => {
  it('returns TL,TR,BR,BL in input px and frees every Mat', async () => {
    const { cv, state } = fakeCv(shuffled)
    const q = await createOpenCvEngine(async () => cv).detect(img)
    expect(q).toEqual([{ x: 10, y: 12 }, { x: 90, y: 8 }, { x: 88, y: 70 }, { x: 12, y: 72 }])
    expect(state.live).toBe(0)
  })

  it('returns null when there is no 4-point contour', async () => {
    expect(await createOpenCvEngine(async () => fakeCv([0, 0, 5, 5, 9, 1]).cv).detect(img)).toBeNull()
  })

  it('returns null when the quad is under 10% of the image', async () => {
    expect(await createOpenCvEngine(async () => fakeCv(shuffled, { area: 100 }).cv).detect(img)).toBeNull()
  })

  it('returns null without contours', async () => {
    const { cv, state } = fakeCv(shuffled)
    state.contours = 0
    expect(await createOpenCvEngine(async () => cv).detect(img)).toBeNull()
  })

  it('returns null for an invalid quad', async () => {
    expect(await createOpenCvEngine(async () => fakeCv([1, 1, 1, 1, 1, 1, 1, 1]).cv).detect(img)).toBeNull()
  })

  it('returns null when cv throws and still frees Mats', async () => {
    const { cv, state } = fakeCv(shuffled, { throwAt: 'Canny' })
    expect(await createOpenCvEngine(async () => cv).detect(img)).toBeNull()
    expect(state.live).toBe(0)
  })

  it('returns null when the loader fails and retries init afterwards', async () => {
    let calls = 0
    const engine = createOpenCvEngine(async () => {
      if (++calls === 1) throw new Error('load failed')
      return fakeCv(shuffled).cv
    })
    await expect(engine.init()).rejects.toThrow('load failed')
    await expect(engine.init()).resolves.toBeUndefined()
    expect(calls).toBe(2)
  })

  it('detect yields null when loading fails', async () => {
    expect(await createOpenCvEngine(async () => { throw new Error('x') }).detect(img)).toBeNull()
  })
})

describe('engine not in the build', () => {
  // The CI matrix also runs the unit tests with VITE_DETECTION_ENGINE=opencv, where this does not apply.
  it.skipIf(import.meta.env.VITE_DETECTION_ENGINE === 'opencv')('opencv is rejected clearly in the default (scanic) build', () => {
    expect(() => createDetectionEngine('opencv')).toThrow(/not included/)
  })
})

describe('opencv module wrapper', () => {
  it('boxes the OpenCV promise so it never crosses a dynamic import as a thenable', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../../src/engines/opencv-module.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/export const opencvModule = \{ ready:/)
    const engine = readFileSync(new URL('../../src/engines/opencv-engine.ts', import.meta.url), 'utf8')
    expect(engine).toMatch(/import\('\.\/opencv-module\.ts'\)/)
    expect(engine).not.toMatch(/import\('@techstark\/opencv-js'\)/)
  })
})
