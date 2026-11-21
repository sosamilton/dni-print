import type { BitmapLike, FaceId } from '../worker/api.ts'

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

export type ThumbnailView =
  | { kind: 'rendered'; bitmap: BitmapLike }
  | { kind: 'preview'; bitmap: BitmapLike }
  | { kind: 'loading' }

/**
 * What the step-1 thumbnail shows. A face with a quad (auto or manual) shows only its crop,
 * or a loading state until the render arrives; never the full photo.
 */
export function thumbnailView(face: {
  quadOrigin: 'default' | 'auto' | 'manual'
  rendered: BitmapLike | null
  previewBitmap: BitmapLike
}): ThumbnailView {
  if (face.quadOrigin === 'default') return { kind: 'preview', bitmap: face.previewBitmap }
  return face.rendered ? { kind: 'rendered', bitmap: face.rendered } : { kind: 'loading' }
}
