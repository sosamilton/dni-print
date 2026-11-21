// In-memory session store (AD-8). No `persist`: nothing here ever touches storage.
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { defaultQuad, DEFAULT_PROFILE_ID, getProfile } from '../core/index.ts'
import type { Quad, Rotation } from '../core/index.ts'
import type { BitmapLike, FaceId, Size } from '../worker/api.ts'

export interface FaceState {
  sourceSize: Size
  previewBitmap: BitmapLike
  quad: Quad
  quadOrigin: 'default' | 'manual'
  rotation: Rotation
  /** Revision of the inputs (quad, rotation, profile, face) this face currently has. */
  rev: number
  rendered: BitmapLike | null
}

export interface SessionState {
  /** Global, monotonic; never reset by clearSession. */
  rev: number
  profileId: string
  faces: Partial<Record<FaceId, FaceState>>
  blobUrls: string[]
  copies: 1 | 2
}

export interface SessionActions {
  /** Registers how to clear the worker; called by the pipeline controller. */
  bindWorker(clearWorker: () => void | Promise<void>): void
  setFace(faceId: FaceId, input: { sourceSize: Size; previewBitmap: BitmapLike }): number
  setQuad(faceId: FaceId, quad: Quad): number | null
  setRotation(faceId: FaceId, rotation: Rotation): number | null
  /** Back to the initial quad (`defaultQuad`, origin 'default'); keeps the rotation. */
  resetQuad(faceId: FaceId): number | null
  /** Returns the new rev of every affected face. */
  setProfile(profileId: string): Partial<Record<FaceId, number>>
  /** Stores a render if its rev is current; otherwise closes it. True when stored. */
  receiveRender(faceId: FaceId, rev: number, bitmap: BitmapLike): boolean
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

    return {
      rev: 0,
      profileId: DEFAULT_PROFILE_ID,
      faces: {},
      blobUrls: [],
      copies: 2,

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
              rotation: 0,
              rev,
              rendered: null,
            },
          },
        }))
        return rev
      },

      setQuad(faceId, quad) {
        return patchFace(faceId, { quad, quadOrigin: 'manual' })
      },

      setRotation(faceId, rotation) {
        return patchFace(faceId, { rotation })
      },

      resetQuad(faceId) {
        const face = get().faces[faceId]
        if (!face) return null
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

      receiveRender(faceId, rev, bitmap) {
        const face = get().faces[faceId]
        if (!face || face.rev !== rev) {
          bitmap.close()
          return false
        }
        face.rendered?.close()
        set((s) => ({ faces: { ...s.faces, [faceId]: { ...face, rendered: bitmap } } }))
        return true
      },

      trackBlobUrl(url) {
        set((s) => ({ blobUrls: [...s.blobUrls, url] }))
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
        set({ faces: {}, blobUrls: [], profileId: DEFAULT_PROFILE_ID, copies: 2 })
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
