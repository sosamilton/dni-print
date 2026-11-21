import { describe, expect, it } from 'vitest'
import { defaultQuad } from '../../src/core/index.ts'
import {
  clampPoint,
  cropWidthPx,
  isLowResolution,
  keyDelta,
  nextRotation,
  screenToSource,
  withCorner,
} from '../../src/ui/corner-editor-model.ts'

describe('corner-editor-model', () => {
  it('clampPoint mantiene el punto dentro de la imagen', () => {
    expect(clampPoint({ x: -5, y: 900 }, 100, 50)).toEqual({ x: 0, y: 50 })
  })
  it('withCorner reemplaza solo un vértice', () => {
    const q = defaultQuad(100, 100)
    const r = withCorner(q, 2, { x: 1, y: 2 })
    expect(r[2]).toEqual({ x: 1, y: 2 })
    expect(r[0]).toBe(q[0])
    expect(q[2]).toEqual({ x: 90, y: 90 })
  })
  it('keyDelta: 1 px, 10 px con Shift, null para otras teclas', () => {
    expect(keyDelta('ArrowLeft', false)).toEqual({ x: -1, y: 0 })
    expect(keyDelta('ArrowDown', true)).toEqual({ x: 0, y: 10 })
    expect(keyDelta('a', false)).toBeNull()
  })
  it('screenToSource escala y limita', () => {
    const src = { widthPx: 2000, heightPx: 1000 }
    expect(screenToSource({ x: 100, y: 50 }, { width: 200, height: 100 }, src)).toEqual({ x: 1000, y: 500 })
    expect(screenToSource({ x: 999, y: -4 }, { width: 200, height: 100 }, src)).toEqual({ x: 2000, y: 0 })
    expect(screenToSource({ x: 1, y: 1 }, { width: 0, height: 0 }, src)).toEqual({ x: 0, y: 0 })
  })
  it('cropWidthPx usa el lado superior tras rotar', () => {
    const q = defaultQuad(1000, 500) // 800 x 400
    expect(cropWidthPx(q, 0)).toBeCloseTo(800)
    expect(cropWidthPx(q, 90)).toBeCloseTo(400)
  })
  it('isLowResolution: < 600 px avisa, inválido no avisa', () => {
    expect(isLowResolution(defaultQuad(700, 400), 0)).toBe(true) // 560
    expect(isLowResolution(defaultQuad(800, 400), 0)).toBe(false) // 640
    const bad = withCorner(defaultQuad(100, 100), 0, { x: 90, y: 90 })
    expect(isLowResolution(bad, 0)).toBe(false)
  })
  it('nextRotation gira de a 90°', () => {
    expect(nextRotation(0)).toBe(90)
    expect(nextRotation(270)).toBe(0)
  })
})
