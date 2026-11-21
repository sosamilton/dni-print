// worker: contract between the UI and the processing worker (AD-17).
// `ui` may import this file; the worker may import `core` and `engines`.
import type { BitmapLike, Placement, Quad, Rotation, Ruler } from '../core/index.ts'

export type { BitmapLike, Placement, Quad, Rotation, Ruler }

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

export interface FaceCrop {
  quad: Quad
  rotation: Rotation
}

/** `placements` and `ruler` come from `layout()` on the main thread; the worker never recomputes them. */
export interface PdfRequest {
  profileId: string
  placements: Placement[]
  ruler: Ruler
  faces: Record<FaceId, FaceCrop>
}

export type PdfResult =
  | { ok: true; pdf: Uint8Array }
  | { ok: false; reason: RenderFailure | 'pdf-failed' }

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
  /** Rectifies both faces and assembles the exact-scale A4 PDF (JPEG 0.92 at the rectified px). */
  buildPdf(request: PdfRequest): Promise<PdfResult>
  /** Closes every bitmap the worker holds. */
  clear(): Promise<void>
}
