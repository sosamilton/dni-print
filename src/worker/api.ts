// worker: contract between the UI and the processing worker (AD-17).
// `ui` may import this file; the worker may import `core` and `engines`.
import type { BitmapLike, FaceFilter, Placement, Quad, Rotation, Ruler, Watermark } from '../core/index.ts'

export type { BitmapLike, FaceFilter, Placement, Quad, Rotation, Ruler, Watermark }

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

export type DetectResult =
  | { ok: true; quad: Quad | null }
  | { ok: false; reason: 'no-source' | 'superseded' | 'detect-failed' }

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
  filter: FaceFilter
  watermark?: Watermark | null
}

export type PdfResult =
  | { ok: true; pdf: Uint8Array }
  | { ok: false; reason: RenderFailure | 'pdf-failed' }

export interface ProcessingApi {
  /** Decodes the blob (EXIF-oriented, long side capped); the full-res bitmap stays in the worker. */
  ingest(faceId: FaceId, blob: Blob): Promise<IngestResult>
  /** Detects the document on a reduced copy; the quad is in px of the full-res source. Null quad: none found. */
  detect(faceId: FaceId): Promise<DetectResult>
  /** Rectifies and renders a face with the given filter. Always echoes `rev` so callers can drop stale answers. */
  render(
    faceId: FaceId,
    quad: Quad,
    rotation: Rotation,
    profileId: string,
    rev: number,
    filter: FaceFilter,
    watermark?: Watermark | null,
  ): Promise<RenderResult>
  /** Rectifies both faces and assembles the exact-scale A4 PDF (JPEG 0.92 at the rectified px). */
  buildPdf(request: PdfRequest): Promise<PdfResult>
  /** Closes every bitmap the worker holds. */
  clear(): Promise<void>
}
