import { describe, expect, it } from 'vitest'
import { defaultQuad } from '../../src/core/index.ts'
import {
  adjacentCorners,
  clampPoint,
  cropWidthPx,
  isLowResolution,
  keyDelta,
  magnifierSide,
  magnifierWindow,
  nextRotation,
  screenToSource,
  toMagnifier,
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

  describe('lupa', () => {
    const src = { widthPx: 1200, heightPx: 800 }
    const prev = { width: 600, height: 400 }
    it('centro: 100 px de vista previa (50 px en pantalla) centrados, destino 0..150', () => {
      expect(magnifierWindow({ x: 600, y: 400 }, src, prev, 300, 150, 3)).toEqual({
        sx: 250, sy: 150, sw: 100, sh: 100, dx: 0, dy: 0, dw: 150, dh: 150,
      })
    })
    it('foto grande: el aumento en pantalla no depende de la fuente', () => {
      const big = { widthPx: 4096, heightPx: 2048 }
      const w = magnifierWindow({ x: 2048, y: 1024 }, big, { width: 1024, height: 512 }, 300, 150, 3)!
      // 150 px de lupa / (sw px de vista previa * 300/1024 px de pantalla por px) = 3×
      expect(150 / (w.sw * (300 / 1024))).toBeCloseTo(3)
      expect(w.dw).toBeCloseTo(150)
    })
    it('esquina de la imagen: ventana recortada y el punto sigue en el centro', () => {
      const w = magnifierWindow({ x: 0, y: 0 }, src, prev, 300, 150, 3)!
      expect(w).toEqual({ sx: 0, sy: 0, sw: 50, sh: 50, dx: 75, dy: 75, dw: 75, dh: 75 })
      expect(toMagnifier({ x: 0, y: 0 }, { x: 0, y: 0 }, src, prev, 300, 150, 3)).toEqual({ x: 75, y: 75 })
      const br = magnifierWindow({ x: 1200, y: 800 }, src, prev, 300, 150, 3)!
      expect(br).toEqual({ sx: 550, sy: 350, sw: 50, sh: 50, dx: 0, dy: 0, dw: 75, dh: 75 })
    })
    it('lados: vecinos de la esquina mapeados a coords de lupa', () => {
      const q = defaultQuad(1200, 800) // TL (120,80) TR (1080,80) BR (1080,720) BL (120,720)
      const [next, prevCorner] = adjacentCorners(q, 0)
      expect(next).toEqual(q[1])
      expect(prevCorner).toEqual(q[3])
      expect(adjacentCorners(q, 3)).toEqual([q[0], q[2]])
      // TR está 960 px de fuente a la derecha = 480 px de vista previa × k (1,5)
      expect(toMagnifier(next, q[0], src, prev, 300, 150, 3)).toEqual({ x: 75 + 720, y: 75 })
    })
    it('lado de la lupa: opuesto en horizontal y vertical', () => {
      expect(magnifierSide({ x: 100, y: 100 }, src)).toEqual({ x: 'right', y: 'bottom' })
      expect(magnifierSide({ x: 1100, y: 700 }, src)).toEqual({ x: 'left', y: 'top' })
    })
    it('tamaño inválido: null sin lanzar', () => {
      expect(magnifierWindow({ x: 1, y: 1 }, src, prev, 0, 150, 3)).toBeNull()
      expect(magnifierWindow({ x: 1, y: 1 }, src, { width: 0, height: 0 }, 300, 150, 3)).toBeNull()
      expect(toMagnifier({ x: 1, y: 1 }, { x: 1, y: 1 }, src, prev, -1, 150, 3)).toBeNull()
    })
  })
})
