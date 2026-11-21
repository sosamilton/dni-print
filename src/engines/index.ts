// engines: the `DetectionEngine` port and its adapters.
// May import from `core` only.
import type { DetectionEngine } from './detection-engine.ts'
import { createScanicEngine } from './scanic-engine.ts'

export type { DetectionEngine } from './detection-engine.ts'

export const DEFAULT_ENGINE_ID = 'scanic'

/** Picks the engine id from `VITE_DETECTION_ENGINE` (default `scanic`). */
export function resolveEngineId(value: string | undefined = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_DETECTION_ENGINE): string {
  return value && value.trim() ? value.trim() : DEFAULT_ENGINE_ID
}

export function createDetectionEngine(id: string = resolveEngineId()): DetectionEngine {
  switch (id) {
    case 'scanic':
      return createScanicEngine()
    default:
      throw new Error(`Unknown detection engine "${id}" (VITE_DETECTION_ENGINE)`)
  }
}
