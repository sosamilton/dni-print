// In-memory session store (AD-8). No `persist`: nothing here ever touches storage.
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { defaultQuad, DEFAULT_PROFILE_ID, FACE_FILTERS, getProfile, MAX_WATERMARK_CHARS } from '../core/index.ts'
import { clampMargin, DEFAULT_MARGIN_MM } from './print-step-model.ts'
import type { FaceFilter, Quad, Rotation } from '../core/index.ts'
import type { BitmapLike, FaceId, Size } from '../worker/api.ts'

export interface FaceState {
  sourceSize: Size
  previewBitmap: BitmapLike
  quad: Quad
  quadOrigin: 'default' | 'auto' | 'manual'
  /** Quad found by the detector, if any; what "Restablecer" returns to. */
  detectedQuad: Quad | null
  rotation: Rotation
  /** Revision of the inputs (quad, rotation, profile, face) this face currently has. */
  rev: number
  rendered: BitmapLike | null
  /** Sharpness of `rendered`'s crop (see `measureSharpness`); null until a render is accepted. */
  sharpness: number | null
}

export interface SessionState {
  /** Global, monotonic; never reset by clearSession. */
  rev: number
  profileId: string
  faces: Partial<Record<FaceId, FaceState>>
  blobUrls: string[]
  copies: 1 | 2
  filter: FaceFilter
  watermarkOn: boolean
  watermarkText: string
  /** Uniform sheet margin in mm (5–20). */
  marginMm: number
}

export interface SessionActions {
  /** Registers how to clear the worker; called by the pipeline controller. */
  bindWorker(clearWorker: () => void | Promise<void>): void
  setFace(faceId: FaceId, input: { sourceSize: Size; previewBitmap: BitmapLike }): number
  setQuad(faceId: FaceId, quad: Quad): number | null
  /** Stores a detected quad and makes it current (origin 'auto'). */
  setDetectedQuad(faceId: FaceId, quad: Quad): number | null
  setRotation(faceId: FaceId, rotation: Rotation): number | null
  /** Back to the detected quad (origin 'auto') or, without one, `defaultQuad` (origin 'default'); keeps the rotation. */
  resetQuad(faceId: FaceId): number | null
  /** Returns the new rev of every affected face. */
  setProfile(profileId: string): Partial<Record<FaceId, number>>
  /** Changes the print filter; returns the new rev of every affected face. */
  setFilter(filter: FaceFilter): Partial<Record<FaceId, number>>
  /** Turns the watermark on/off; returns the new rev of every affected face. */
  setWatermarkOn(on: boolean): Partial<Record<FaceId, number>>
  /** Sets the watermark text (cut to 40 chars); returns the new rev of every affected face. */
  setWatermarkText(text: string): Partial<Record<FaceId, number>>
  /** Sets the sheet margin (clamped to 5–20 mm). Layout-only: no re-render needed. */
  setMarginMm(mm: number): void
  /** Stores a render (and its sharpness) if its rev is current; otherwise closes it. True when stored. */
  receiveRender(faceId: FaceId, rev: number, bitmap: BitmapLike, sharpness: number | null): boolean
  trackBlobUrl(url: string): void
  setCopies(copies: 1 | 2): void
  /** Creates a tracked blob URL for the PDF; release it with `releaseUrl`. */
  createPdfUrl(pdf: Uint8Array): string
  releaseUrl(url: string): void
  clearSession(): void
}

export type SessionStore = SessionState & SessionActions

export interface SessionDeps {
  clearWorker?: () => void | Promise<void>
  revokeUrl: (url: string) => void
  createUrl?: (blob: Blob) => string
}

export function createSessionStore(deps: SessionDeps) {
  let clearWorker = deps.clearWorker

  return createStore<SessionStore>()((set, get) => {
    const bump = (): number => {
      const rev = get().rev + 1
      set({ rev })
      return rev
    }
    const patchFace = (faceId: FaceId, patch: Partial<FaceState>): number | null => {
      const face = get().faces[faceId]
      if (!face) return null
      const rev = bump()
      set((s) => ({ faces: { ...s.faces, [faceId]: { ...face, ...patch, rev } } }))
      return rev
    }

    const bumpAll = (): Partial<Record<FaceId, number>> => {
      const revs: Partial<Record<FaceId, number>> = {}
      for (const faceId of Object.keys(get().faces) as FaceId[]) {
        revs[faceId] = patchFace(faceId, {}) ?? undefined
      }
      return revs
    }

    return {
      rev: 0,
      profileId: DEFAULT_PROFILE_ID,
      faces: {},
      blobUrls: [],
      copies: 2,
      filter: 'color',
      watermarkOn: false,
      watermarkText: '',
      marginMm: DEFAULT_MARGIN_MM,

      bindWorker(fn) {
        clearWorker = fn
      },

      setFace(faceId, { sourceSize, previewBitmap }) {
        const old = get().faces[faceId]
        old?.previewBitmap.close()
        old?.rendered?.close()
        const rev = bump()
        set((s) => ({
          faces: {
            ...s.faces,
            [faceId]: {
              sourceSize,
              previewBitmap,
              quad: defaultQuad(sourceSize.widthPx, sourceSize.heightPx),
              quadOrigin: 'default',
              detectedQuad: null,
              rotation: 0,
              rev,
              rendered: null,
              sharpness: null,
            },
          },
        }))
        return rev
      },

      setQuad(faceId, quad) {
        return patchFace(faceId, { quad, quadOrigin: 'manual' })
      },

      setDetectedQuad(faceId, quad) {
        return patchFace(faceId, { quad, quadOrigin: 'auto', detectedQuad: quad })
      },

      setRotation(faceId, rotation) {
        return patchFace(faceId, { rotation })
      },

      resetQuad(faceId) {
        const face = get().faces[faceId]
        if (!face) return null
        if (face.detectedQuad) return patchFace(faceId, { quad: face.detectedQuad, quadOrigin: 'auto' })
        const { widthPx, heightPx } = face.sourceSize
        return patchFace(faceId, { quad: defaultQuad(widthPx, heightPx), quadOrigin: 'default' })
      },

      setProfile(profileId) {
        if (!getProfile(profileId)) return {}
        set({ profileId })
        const revs: Partial<Record<FaceId, number>> = {}
        for (const faceId of Object.keys(get().faces) as FaceId[]) {
          revs[faceId] = patchFace(faceId, {}) ?? undefined
        }
        return revs
      },

      setFilter(filter) {
        if (!FACE_FILTERS.includes(filter)) return {}
        if (get().filter === filter) return {}
        set({ filter })
        const revs: Partial<Record<FaceId, number>> = {}
        for (const faceId of Object.keys(get().faces) as FaceId[]) {
          revs[faceId] = patchFace(faceId, {}) ?? undefined
        }
        return revs
      },

      setWatermarkOn(on) {
        if (get().watermarkOn === on) return {}
        set({ watermarkOn: on })
        return get().watermarkText.trim() ? bumpAll() : {}
      },

      setWatermarkText(text) {
        const next = Array.from(text).slice(0, MAX_WATERMARK_CHARS).join('')
        if (get().watermarkText === next) return {}
        set({ watermarkText: next })
        return get().watermarkOn ? bumpAll() : {}
      },

      receiveRender(faceId, rev, bitmap, sharpness) {
        const face = get().faces[faceId]
        if (!face || face.rev !== rev) {
          bitmap.close()
          return false
        }
        face.rendered?.close()
        set((s) => ({ faces: { ...s.faces, [faceId]: { ...face, rendered: bitmap, sharpness } } }))
        return true
      },

      trackBlobUrl(url) {
        set((s) => ({ blobUrls: [...s.blobUrls, url] }))
      },

      setMarginMm(mm) {
        set({ marginMm: clampMargin(mm) })
      },

      setCopies(copies) {
        set({ copies })
      },

      createPdfUrl(pdf) {
        const make = deps.createUrl ?? ((blob: Blob) => URL.createObjectURL(blob))
        const url = make(new Blob([pdf as unknown as ArrayBuffer], { type: 'application/pdf' }))
        set((s) => ({ blobUrls: [...s.blobUrls, url] }))
        return url
      },

      releaseUrl(url) {
        if (!get().blobUrls.includes(url)) return
        deps.revokeUrl(url)
        set((s) => ({ blobUrls: s.blobUrls.filter((u) => u !== url) }))
      },

      clearSession() {
        const { faces, blobUrls } = get()
        for (const url of blobUrls) deps.revokeUrl(url)
        for (const face of Object.values(faces)) {
          face.previewBitmap.close()
          face.rendered?.close()
        }
        set({ faces: {}, blobUrls: [], profileId: DEFAULT_PROFILE_ID, copies: 2, filter: 'color', watermarkOn: false, watermarkText: '', marginMm: DEFAULT_MARGIN_MM })
        try {
          void Promise.resolve(clearWorker?.()).catch(() => {})
        } catch {
          // The worker may already be gone; nothing else to release.
        }
      },
    }
  })
}

export const sessionStore = createSessionStore({ revokeUrl: (url) => URL.revokeObjectURL(url) })

export function useSession<T>(selector: (state: SessionStore) => T): T {
  return useStore(sessionStore, selector)
}
