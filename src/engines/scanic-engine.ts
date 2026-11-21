import { scanDocument } from 'scanic'
import type { ScannerResult, ScanicImageSource } from 'scanic'
import { validateQuad } from '../core/index.ts'
import type { PixelImage, Quad } from '../core/index.ts'
import type { DetectionEngine } from './detection-engine.ts'

export type ScanFn = (img: ScanicImageSource) => Promise<Pick<ScannerResult, 'success' | 'isValid' | 'corners'>>

/** scanic needs a real `ImageData` (it calls putImageData); Node tests have none and use a fake `scan`. */
function toScanicInput(img: PixelImage): ScanicImageSource {
  const ImageDataCtor = (globalThis as { ImageData?: new (data: Uint8ClampedArray, w: number, h: number) => object }).ImageData
  return (ImageDataCtor ? new ImageDataCtor(img.data, img.width, img.height) : img) as unknown as ScanicImageSource
}

/** Classical (non-ML) scanic detector. `scan` is injectable so tests need no canvas. */
export function createScanicEngine(scan: ScanFn = (img) => scanDocument(img)): DetectionEngine {
  return {
    id: 'scanic',
    async init() {},
    async detect(img: PixelImage): Promise<Quad | null> {
      try {
        const result = await scan(toScanicInput(img))
        const c = result?.corners
        if (!result?.success || !result.isValid || !c) return null
        const quad: Quad = [
          { x: c.topLeft.x, y: c.topLeft.y },
          { x: c.topRight.x, y: c.topRight.y },
          { x: c.bottomRight.x, y: c.bottomRight.y },
          { x: c.bottomLeft.x, y: c.bottomLeft.y },
        ]
        return validateQuad(quad) ? quad : null
      } catch {
        return null
      }
    },
  }
}
