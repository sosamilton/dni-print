// engines: the `DetectionEngine` port and its adapters.
// May import from `core` only.
import type { DetectionEngine } from './detection-engine.ts'
import { createOpenCvEngine } from './opencv-engine.ts'
import { createScanicEngine } from './scanic-engine.ts'

export type { DetectionEngine } from './detection-engine.ts'

export const DEFAULT_ENGINE_ID = 'scanic'

/** Compile-time engine id; Rollup drops the branch (and its dependency) of the engine not chosen. */
const BUILD_ENGINE: string = import.meta.env.VITE_DETECTION_ENGINE?.trim() || DEFAULT_ENGINE_ID

/** Picks the engine id from `VITE_DETECTION_ENGINE` (default `scanic`). */
export function resolveEngineId(value: string | undefined = import.meta.env.VITE_DETECTION_ENGINE): string {
  return value && value.trim() ? value.trim() : DEFAULT_ENGINE_ID
}

export function createDetectionEngine(id: string = resolveEngineId()): DetectionEngine {
  if (id === 'scanic') {
    if (BUILD_ENGINE === 'scanic') return createScanicEngine()
    throw new Error('Detection engine "scanic" is not included in this build (VITE_DETECTION_ENGINE)')
  }
  if (id === 'opencv') {
    if (BUILD_ENGINE === 'opencv') return createOpenCvEngine()
    throw new Error('Detection engine "opencv" is not included in this build (VITE_DETECTION_ENGINE)')
  }
  throw new Error(`Unknown detection engine "${id}" (VITE_DETECTION_ENGINE)`)
}
