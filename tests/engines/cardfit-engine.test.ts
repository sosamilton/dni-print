import { describe, expect, it } from 'vitest'
import { createCardFitEngine } from '../../src/engines/cardfit-engine.ts'
import { createDetectionEngine, DEFAULT_ENGINE_ID } from '../../src/engines/index.ts'
import { makeScene } from '../core/card-scene.ts'
import type { Quad } from '../../src/core/index.ts'

const img = { width: 100, height: 80, data: new Uint8ClampedArray(100 * 80 * 4) }
const quad: Quad = [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 60 }, { x: 10, y: 60 }]

describe('cardfit engine', () => {
  it('returns what the finder returns and never throws', async () => {
    expect(await createCardFitEngine(() => quad).detect(img)).toBe(quad)
    expect(await createCardFitEngine(() => null).detect(img)).toBeNull()
    expect(await createCardFitEngine(() => { throw new Error('boom') }).detect(img)).toBeNull()
  })

  it('has the id cardfit, needs no setup and is the default engine', async () => {
    const engine = createCardFitEngine()
    expect(engine.id).toBe('cardfit')
    await expect(engine.init()).resolves.toBeUndefined()
    expect(DEFAULT_ENGINE_ID).toBe('cardfit')
  })

  it('detects a synthetic card end to end (real finder, no browser)', async () => {
    const corners: Quad = [{ x: 160, y: 140 }, { x: 480, y: 140 }, { x: 480, y: 340 }, { x: 160, y: 340 }]
    const found = await createCardFitEngine().detect(makeScene({ width: 640, height: 480, corners }))
    expect(found).not.toBeNull()
    expect(Math.abs(found![0].x - 160)).toBeLessThan(4)
  })

  it('is only available when the build includes it', () => {
    const built = import.meta.env.VITE_DETECTION_ENGINE?.trim() || 'cardfit'
    if (built === 'cardfit') expect(createDetectionEngine('cardfit').id).toBe('cardfit')
    else expect(() => createDetectionEngine('cardfit')).toThrow(/not included/)
  })
})
