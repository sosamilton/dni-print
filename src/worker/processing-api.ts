// Worker logic, testable without a DOM: all browser imaging goes through ImagingBackend.
import { chooseRotation, DEFAULT_PROFILE_ID, FACE_FILTERS, getProfile, isWatermark, measureSharpness, normalizeWatermark, rectify, refineQuad, renderFace, stampFace, validateQuad } from '../core/index.ts'
import type { PixelImage, Quad, RasterBackend } from '../core/index.ts'
import { buildPdfDocument } from '../core/pdf.ts'
import type { GrayFace, JpegFace } from '../core/pdf.ts'
import type { DetectionEngine } from '../engines/index.ts'
import type { BitmapLike, FaceId, ProcessingApi } from './api.ts'

export const MAX_SOURCE_SIDE_PX = 4096
export const MAX_PREVIEW_SIDE_PX = 1024
export const MAX_DETECT_SIDE_PX = 1024
export const PDF_JPEG_QUALITY = 0.92

export interface ImagingBackend {
  /** Decodes with EXIF orientation applied; null if the blob is not a decodable image. */
  decode(blob: Blob): Promise<BitmapLike | null>
  /** Creates a NEW bitmap whose long side is at most `maxSidePx` (never upscales). */
  scaleTo(bitmap: BitmapLike, maxSidePx: number): Promise<BitmapLike>
  readPixels(bitmap: BitmapLike): PixelImage
  /** Encodes pixels as a JPEG at their exact size. */
  encodeJpeg(pixels: PixelImage, quality: number): Promise<Uint8Array>
  raster: RasterBackend
}

const ROTATIONS = [0, 90, 180, 270]

export function createProcessingApi(imaging: ImagingBackend, engine?: DetectionEngine): ProcessingApi {
  const sources = new Map<FaceId, BitmapLike>()
  // Latest ingest token per face; clear() and newer ingests invalidate in-flight ones.
  const latestIngest = new Map<FaceId, number>()
  let ingestCounter = 0
  let engineReady: Promise<void> | null = null

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

    async detect(faceId) {
      const source = sources.get(faceId)
      if (!source) return { ok: false, reason: 'no-source' }
      if (!engine) return { ok: false, reason: 'detect-failed' }
      const token = latestIngest.get(faceId)
      const stale = () => sources.get(faceId) !== source || latestIngest.get(faceId) !== token
      let small: BitmapLike | null = null
      try {
        const ready = (engineReady ??= engine.init())
        try {
          await ready
        } catch (error) {
          if (engineReady === ready) engineReady = null // retry on the next call
          throw error
        }
        if (stale()) return { ok: false, reason: 'superseded' }
        small = await imaging.scaleTo(source, MAX_DETECT_SIDE_PX)
        if (!small.width || !small.height) return { ok: false, reason: 'detect-failed' }
        const quad = await engine.detect(imaging.readPixels(small))
        if (stale()) return { ok: false, reason: 'superseded' }
        if (!quad) return { ok: true, quad: null, rotation: 0 }
        const kx = source.width / small.width
        const ky = source.height / small.height
        const scaled = quad.map((p) => ({ x: p.x * kx, y: p.y * ky })) as Quad
        if (!validateQuad(scaled)) return { ok: true, quad: null, rotation: 0 }
        // The rescale multiplies the reduced copy's error; snap the sides on the full-res source.
        const pixels = imaging.readPixels(source)
        const refined = refineQuad(pixels, scaled)
        const profile = getProfile(DEFAULT_PROFILE_ID)
        return { ok: true, quad: refined, rotation: profile ? chooseRotation(pixels, refined, profile).rotation : 0 }
      } catch {
        return stale() ? { ok: false, reason: 'superseded' } : { ok: false, reason: 'detect-failed' }
      } finally {
        small?.close()
      }
    },

    async orient(faceId, quad, profileId) {
      const source = sources.get(faceId)
      if (!source) return { ok: false, reason: 'no-source' }
      const profile = getProfile(profileId)
      if (!profile) return { ok: false, reason: 'unknown-profile' }
      if (!validateQuad(quad)) return { ok: false, reason: 'invalid-quad' }
      return { ok: true, rotation: chooseRotation(imaging.readPixels(source), quad, profile).rotation }
    },

    async render(faceId, quad, rotation, profileId, rev, filter, watermark) {
      const source = sources.get(faceId)
      if (!source) return { ok: false, rev, reason: 'no-source' }
      const profile = getProfile(profileId)
      if (!profile) return { ok: false, rev, reason: 'unknown-profile' }
      if (!FACE_FILTERS.includes(filter)) return { ok: false, rev, reason: 'render-failed' }
      if (!validateQuad(quad) || !ROTATIONS.includes(rotation)) {
        return { ok: false, rev, reason: 'invalid-quad' }
      }
      try {
        const rectified = rectify(imaging.readPixels(source), quad, rotation, profile)
        if (!rectified) return { ok: false, rev, reason: 'invalid-quad' }
        // Measured on the color crop: the filter and the watermark's sharp edges would hide the blur.
        const sharpness = measureSharpness(rectified)
        const face = await renderFace(rectified, filter, watermark ?? null, imaging.raster)
        if (!face) return { ok: false, rev, reason: 'render-failed' }
        return { ok: true, rev, face, sharpness }
      } catch {
        return { ok: false, rev, reason: 'render-failed' }
      }
    },

    async buildPdf(request) {
      const profile = getProfile(request.profileId)
      if (!profile) return { ok: false, reason: 'unknown-profile' }
      if (!FACE_FILTERS.includes(request.filter)) return { ok: false, reason: 'pdf-failed' }
      const requested = request.watermark ?? null
      if (requested !== null && !isWatermark(requested)) return { ok: false, reason: 'pdf-failed' }
      const watermark = requested && normalizeWatermark(true, requested.text)
      try {
        const jpegs = {} as Record<FaceId, JpegFace | GrayFace>
        for (const faceId of ['front', 'back'] as const) {
          const source = sources.get(faceId)
          if (!source) return { ok: false, reason: 'no-source' }
          const { quad, rotation } = request.faces[faceId]
          if (!validateQuad(quad) || !ROTATIONS.includes(rotation)) return { ok: false, reason: 'invalid-quad' }
          const rectified = rectify(imaging.readPixels(source), quad, rotation, profile)
          if (!rectified) return { ok: false, reason: 'invalid-quad' }
          // Same filter-then-watermark path as the preview, so both match.
          const stamped = await stampFace(rectified, request.filter, watermark, imaging.raster)
          if (request.filter === 'color') {
            jpegs[faceId] = { jpeg: await imaging.encodeJpeg(stamped, PDF_JPEG_QUALITY) }
          } else {
            const gray = new Uint8Array(stamped.width * stamped.height)
            for (let i = 0; i < gray.length; i++) gray[i] = stamped.data[i * 4]!
            jpegs[faceId] = { gray: { width: stamped.width, height: stamped.height, data: gray } }
          }
        }
        const pdf = buildPdfDocument(request.placements, request.ruler, request.cutLine, jpegs)
        return pdf ? { ok: true, pdf } : { ok: false, reason: 'pdf-failed' }
      } catch {
        return { ok: false, reason: 'pdf-failed' }
      }
    },

    async clear() {
      latestIngest.clear()
      for (const bitmap of sources.values()) bitmap.close()
      sources.clear()
    },
  }
}
