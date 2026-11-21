// worker: contract between the UI and the processing worker (AD-17).
// `ui` may import this file; the worker may import `core` and `engines`.
import type { BitmapLike, Quad, Rotation } from '../core/index.ts'

export type { BitmapLike, Quad, Rotation }

export type FaceId = 'front' | 'back'

export interface Size {
  widthPx: number
  heightPx: number
}

export type IngestResult =
  | { ok: true; sourceSize: Size; previewBitmap: BitmapLike }
  | { ok: false; reason: 'not-image' | 'superseded' }

export type RenderFailure = 'no-source' | 'invalid-quad' | 'unknown-profile' | 'render-failed'

export type RenderResult =
  | { ok: true; rev: number; face: BitmapLike }
  | { ok: false; rev: number; reason: RenderFailure }

export type NotImplemented = { ok: false; reason: 'not-implemented' }

export interface ProcessingApi {
  /** Decodes the blob (EXIF-oriented, long side capped); the full-res bitmap stays in the worker. */
  ingest(faceId: FaceId, blob: Blob): Promise<IngestResult>
  /** Stub until Epic 3 (automatic detection). */
  detect(faceId: FaceId): Promise<NotImplemented>
  /** Rectifies and renders a face in color. Always echoes `rev` so callers can drop stale answers. */
  render(
    faceId: FaceId,
    quad: Quad,
    rotation: Rotation,
    profileId: string,
    rev: number,
  ): Promise<RenderResult>
  /** Stub until story 2.5 (PDF). */
  buildPdf(): Promise<NotImplemented>
  /** Closes every bitmap the worker holds. */
  clear(): Promise<void>
}
