import { findCardQuad } from '../core/index.ts'
import type { PixelImage, Quad } from '../core/index.ts'
import type { DetectionEngine } from './detection-engine.ts'

export type FindQuadFn = (img: PixelImage) => Quad | null

/** Default detector: gradient lines + the card's shape (`core/geometry/card-fit`). `find` is injectable for tests. */
export function createCardFitEngine(find: FindQuadFn = (img) => findCardQuad(img)): DetectionEngine {
  return {
    id: 'cardfit',
    async init() {},
    async detect(img: PixelImage): Promise<Quad | null> {
      try {
        return find(img)
      } catch {
        return null
      }
    },
  }
}
