// Worker logic, testable without a DOM: all browser imaging goes through ImagingBackend.
import { getProfile, rectify, renderFace, validateQuad } from '../core/index.ts'
import type { PixelImage, RasterBackend } from '../core/index.ts'
import type { BitmapLike, FaceId, ProcessingApi } from './api.ts'

export const MAX_SOURCE_SIDE_PX = 4096
export const MAX_PREVIEW_SIDE_PX = 1024

export interface ImagingBackend {
  /** Decodes with EXIF orientation applied; null if the blob is not a decodable image. */
  decode(blob: Blob): Promise<BitmapLike | null>
  /** Creates a NEW bitmap whose long side is at most `maxSidePx` (never upscales). */
  scaleTo(bitmap: BitmapLike, maxSidePx: number): Promise<BitmapLike>
  readPixels(bitmap: BitmapLike): PixelImage
  raster: RasterBackend
}

const ROTATIONS = [0, 90, 180, 270]

export function createProcessingApi(imaging: ImagingBackend): ProcessingApi {
  const sources = new Map<FaceId, BitmapLike>()
  // Latest ingest token per face; clear() and newer ingests invalidate in-flight ones.
  const latestIngest = new Map<FaceId, number>()
  let ingestCounter = 0

  return {
    async ingest(faceId, blob) {
      const token = ++ingestCounter
      latestIngest.set(faceId, token)
      if (!blob?.type?.startsWith('image/')) return { ok: false, reason: 'not-image' }
      let decoded: BitmapLike | null = null
      try {
        decoded = await imaging.decode(blob)
      } catch {
        decoded = null
      }
      if (!decoded) return { ok: false, reason: 'not-image' }

      let full = decoded
      if (Math.max(decoded.width, decoded.height) > MAX_SOURCE_SIDE_PX) {
        full = await imaging.scaleTo(decoded, MAX_SOURCE_SIDE_PX)
        decoded.close()
      }
      const previewBitmap = await imaging.scaleTo(full, MAX_PREVIEW_SIDE_PX)
      if (latestIngest.get(faceId) !== token) {
        // clear() or a newer ingest happened meanwhile: keep nothing from this one.
        full.close()
        previewBitmap.close()
        return { ok: false, reason: 'superseded' }
      }
      sources.get(faceId)?.close()
      sources.set(faceId, full)
      return {
        ok: true,
        sourceSize: { widthPx: full.width, heightPx: full.height },
        previewBitmap,
      }
    },

    // Documented stub: automatic detection arrives in Epic 3.
    async detect() {
      return { ok: false, reason: 'not-implemented' }
    },

    async render(faceId, quad, rotation, profileId, rev) {
      const source = sources.get(faceId)
      if (!source) return { ok: false, rev, reason: 'no-source' }
      const profile = getProfile(profileId)
      if (!profile) return { ok: false, rev, reason: 'unknown-profile' }
      if (!validateQuad(quad) || !ROTATIONS.includes(rotation)) {
        return { ok: false, rev, reason: 'invalid-quad' }
      }
      try {
        const rectified = rectify(imaging.readPixels(source), quad, rotation, profile)
        if (!rectified) return { ok: false, rev, reason: 'invalid-quad' }
        const face = await renderFace(rectified, 'color', null, imaging.raster)
        if (!face) return { ok: false, rev, reason: 'render-failed' }
        return { ok: true, rev, face }
      } catch {
        return { ok: false, rev, reason: 'render-failed' }
      }
    },

    // Documented stub: PDF generation arrives in story 2.5.
    async buildPdf() {
      return { ok: false, reason: 'not-implemented' }
    },

    async clear() {
      latestIngest.clear()
      for (const bitmap of sources.values()) bitmap.close()
      sources.clear()
    },
  }
}
