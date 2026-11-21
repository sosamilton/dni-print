import { describe, expect, it } from 'vitest'
import { getProfile, layout, uniformMargins } from '../../src/core/index.ts'
import { CUT_LABEL, buildPdfDocument } from '../../src/core/pdf.ts'
import { strings } from '../../src/ui/strings.es.ts'
import { fakeJpeg } from '../worker/fake-imaging.ts'

const PT = 25.4 / 72
const dni = getProfile('dni-ar')!

function build(copies: 1 | 2) {
  const r = layout(dni, copies, uniformMargins(10))
  if (!r.ok) throw new Error('layout')
  const face = { jpeg: fakeJpeg(1011, 638) }
  const bytes = buildPdfDocument(r.placements, r.ruler, r.cutLine, { front: face, back: face })!
  return { r, text: new TextDecoder('latin1').decode(bytes) }
}

describe('buildPdfDocument', () => {
  it('writes an A4 page, PrintScaling None and the ruler label', () => {
    const { text } = build(2)
    const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text)!
    expect(Number(box[1])).toBeCloseTo(595.28, 1)
    expect(Number(box[2])).toBeCloseTo(841.89, 1)
    expect(text).toMatch(/\/PrintScaling\s*\/None/)
    expect(text).toContain('(100 mm) Tj')
    expect(text).toMatch(/\/Width\s*1011/)
    expect(text).toMatch(/\/Height\s*638/)
    expect(text).toMatch(/\/Filter\s*\/DCTDecode/)
  })

  it('places each image at its Placement within 0.1 mm', () => {
    const { r, text } = build(2)
    const draws = [...text.matchAll(/q\s+([\d.]+)\s+0\s+0\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+cm\s*\/\w+\s+Do\s+Q/g)]
    expect(draws).toHaveLength(4)
    r.placements.forEach((p, i) => {
      const [, w, h, x, y] = draws[i].map(Number)
      expect(w * PT).toBeCloseTo(p.widthMm, 1)
      expect(h * PT).toBeCloseTo(p.heightMm, 1)
      expect(x * PT).toBeCloseTo(p.xMm, 1)
      expect(297 - (y + h) * PT).toBeCloseTo(p.yMm, 1) // PDF y axis goes up
    })
  })

  it('draws a 100 mm ruler line at the ruler position', () => {
    const { r, text } = build(1)
    const lines = [...text.matchAll(/([\d.]+)\s+([\d.]+)\s+m\s+([\d.]+)\s+([\d.]+)\s+l\s+S/g)].map((m) => m.slice(1).map(Number))
    const horizontal = lines.find(([, y1, , y2]) => y1 === y2)!
    expect((horizontal[2] - horizontal[0]) * PT).toBeCloseTo(100, 1)
    expect(horizontal[0] * PT).toBeCloseTo(r.ruler.xMm, 1)
    expect(297 - horizontal[1] * PT).toBeCloseTo(r.ruler.yMm, 1)
  })

  it('draws a dashed cut line at 148.5 mm with its label for 2 copies', () => {
    const { r, text } = build(2)
    const dash = /\[[\d.\s]+\]\s+0\.?\s+d/.exec(text)!
    expect(dash).not.toBeNull()
    expect(text.slice(dash.index + dash[0].length)).toMatch(/\[\]\s+0\.?\s+d/) // dash pattern reset afterwards
    expect(text).toContain('(Cortar aquí) Tj')
    expect(CUT_LABEL).toBe(strings.printStep.cutLabel)
    const lines = [...text.matchAll(/([\d.]+)\s+([\d.]+)\s+m\s+([\d.]+)\s+([\d.]+)\s+l\s+S/g)].map((m) => m.slice(1).map(Number))
    const cut = lines.find(([x1, y1, x2, y2]) => y1 === y2 && Math.abs(297 - y1 * PT - 148.5) < 0.1 && x2 > x1)!
    expect(cut).toBeDefined()
    expect(cut[0] * PT).toBeCloseTo(r.cutLine!.x1Mm, 1)
    expect(cut[2] * PT).toBeCloseTo(r.cutLine!.x2Mm, 1)
  })

  it('has no dash pattern nor cut label for 1 copy', () => {
    const { text } = build(1)
    expect(text).not.toMatch(/\[[\d.\s]+\]\s+0\.?\s+d/)
    expect(text).not.toContain('Cortar aqu')
  })

  it('embeds gray faces with ColorSpace DeviceGray and no DeviceRGB image', () => {
    const r = layout(dni, 2, uniformMargins(10))
    if (!r.ok) throw new Error('layout')
    const gray = { width: 40, height: 25, data: new Uint8Array(40 * 25).fill(180) }
    const bytes = buildPdfDocument(r.placements, r.ruler, r.cutLine, { front: { gray }, back: { gray } })!
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text).toMatch(/\/ColorSpace\s*\/DeviceGray/)
    expect(text).not.toMatch(/\/ColorSpace\s*\/DeviceRGB/)
    expect(text).toMatch(/\/Width\s*40/)
    expect(text.match(/\/I\d+ Do/g)).toHaveLength(4)
  })
})
