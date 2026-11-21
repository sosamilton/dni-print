import type { FaceId } from '../worker/api.ts'

export type FaceStatus = 'empty' | 'processing' | 'loaded' | 'error'

/** "Continuar" is enabled only when both faces are loaded. */
export function canContinue(faces: Partial<Record<FaceId, unknown>>): boolean {
  return Boolean(faces.front) && Boolean(faces.back)
}

/** Status shown on a face slot. A face being (re)processed shows "processing" even if a previous photo exists. */
export function faceStatus(input: { loaded: boolean; processing: boolean; error: boolean }): FaceStatus {
  if (input.processing) return 'processing'
  if (input.error) return 'error'
  return input.loaded ? 'loaded' : 'empty'
}
