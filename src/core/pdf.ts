// PDF assembly (AD-3, AD-6): exact-scale A4 sheet from a layout result and JPEG faces.
import { jsPDF } from 'jspdf'
import { encodeGrayPng } from './gray-png.ts'
import type { Placement, Ruler } from './layout.ts'

export const RULER_LABEL = '100 mm'
const TICK_MM = 2

export interface JpegFace {
  /** JPEG bytes at the exact px of the rectified face. */
  jpeg: Uint8Array
}

/** Black-and-white face: embedded as a 1-component image (ColorSpace DeviceGray). */
export interface GrayFace {
  gray: { width: number; height: number; data: Uint8Array }
}

/** Builds the PDF bytes. Returns null if a placement has no matching face image. */
export function buildPdfDocument(
  placements: readonly Placement[],
  ruler: Ruler,
  faces: Record<'front' | 'back', JpegFace | GrayFace>,
): Uint8Array | null {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  doc.viewerPreferences({ PrintScaling: 'None' })
  for (const p of placements) {
    const face = faces[p.face]
    if (!face) return null
    // Same alias per face: the image is embedded once and reused across copies.
    if ('gray' in face) {
      const png = encodeGrayPng(face.gray.width, face.gray.height, face.gray.data)
      doc.addImage(png, 'PNG', p.xMm, p.yMm, p.widthMm, p.heightMm, `face-${p.face}`, 'FAST')
    } else {
      doc.addImage(face.jpeg, 'JPEG', p.xMm, p.yMm, p.widthMm, p.heightMm, `face-${p.face}`, 'NONE')
    }
  }
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  const x2 = ruler.xMm + ruler.lengthMm
  doc.line(ruler.xMm, ruler.yMm, x2, ruler.yMm)
  doc.line(ruler.xMm, ruler.yMm - TICK_MM, ruler.xMm, ruler.yMm + TICK_MM)
  doc.line(x2, ruler.yMm - TICK_MM, x2, ruler.yMm + TICK_MM)
  doc.setFontSize(9)
  doc.text(RULER_LABEL, ruler.xMm + ruler.lengthMm / 2, ruler.yMm - TICK_MM - 1, { align: 'center' })
  return new Uint8Array(doc.output('arraybuffer'))
}
