import { describe, expect, it } from 'vitest'
import { createDetectionEngine, resolveEngineId } from '../../src/engines/index.ts'
import { createScanicEngine } from '../../src/engines/scanic-engine.ts'

const img = { width: 100, height: 80, data: new Uint8ClampedArray(100 * 80 * 4) }
const p = (x: number, y: number) => ({ x, y })
const corners = {
  topLeft: p(10, 12), topRight: p(90, 8), bottomRight: p(88, 70), bottomLeft: p(12, 72),
}
const engineWith = (r: unknown) => createScanicEngine((async () => r) as never)

describe('scanic engine', () => {
  it('returns TL,TR,BR,BL for a valid document', async () => {
    const q = await engineWith({ success: true, isValid: true, corners }).detect(img)
    expect(q).toEqual([p(10, 12), p(90, 8), p(88, 70), p(12, 72)])
  })

  it.each([
    ['isValid false', { success: true, isValid: false, corners }],
    ['success false', { success: false, isValid: true, corners }],
    ['no corners', { success: true, isValid: true, corners: null }],
    ['degenerate quad', { success: true, isValid: true, corners: { topLeft: p(1, 1), topRight: p(1, 1), bottomRight: p(1, 1), bottomLeft: p(1, 1) } }],
  ])('returns null for %s', async (_n, r) => {
    expect(await engineWith(r).detect(img)).toBeNull()
  })

  it('returns null when scan throws', async () => {
    const e = createScanicEngine(async () => { throw new Error('boom') })
    expect(await e.detect(img)).toBeNull()
  })
})

describe('scanic input', () => {
  it('hands scanic a real ImageData when the runtime has one', async () => {
    class FakeImageData {
      data: Uint8ClampedArray
      width: number
      height: number
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data
        this.width = width
        this.height = height
      }
    }
    const g = globalThis as { ImageData?: unknown }
    const saved = g.ImageData
    g.ImageData = FakeImageData
    try {
      let seen: unknown
      const e = createScanicEngine(async (i) => ((seen = i), { success: false, isValid: false, corners: null }))
      await e.detect({ width: 2, height: 1, data: new Uint8ClampedArray(8) })
      expect(seen).toBeInstanceOf(FakeImageData)
    } finally {
      g.ImageData = saved
    }
  })
})

describe('engine selection', () => {
  it('defaults to scanic and rejects unknown ids', () => {
    expect(resolveEngineId('')).toBe('scanic')
    expect(resolveEngineId(' scanic ')).toBe('scanic')
    expect(createDetectionEngine('scanic').id).toBe('scanic')
    expect(() => createDetectionEngine('foo')).toThrow(/foo/)
  })
})
