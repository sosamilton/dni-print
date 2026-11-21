import type { PixelImage, Quad } from '../core/index.ts'

/** Port for automatic document detection (AD-1). Adapters only detect: they never crop or warp. */
export interface DetectionEngine {
  readonly id: string
  /** Loads whatever the engine needs; may be called again after a failure. */
  init(): Promise<void>
  /** Quad in px of `img`, ordered TL, TR, BR, BL; null when no valid document is found. Never throws. */
  detect(img: PixelImage): Promise<Quad | null>
}
