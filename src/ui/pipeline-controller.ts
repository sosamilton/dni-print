// The only caller of the processing worker (AD-9). Tracks `rev` per face and drops stale answers.
import { validateQuad } from '../core/index.ts'
import type { Quad, Rotation } from '../core/index.ts'
import type { DetectResult, FaceId, IngestResult, PdfResult, ProcessingApi } from '../worker/api.ts'
import { sheetLayout } from './print-step-model.ts'
import { sessionStore } from './session-store.ts'
import type { SessionStore } from './session-store.ts'
import type { StoreApi } from 'zustand/vanilla'

export interface ApiProvider {
  /** Returns the worker API, creating the worker on first use. */
  get(): ProcessingApi
  /** Returns the API only if the worker already exists. */
  peek(): ProcessingApi | null
}

export interface PipelineControllerDeps {
  api: ApiProvider
  store?: StoreApi<SessionStore>
}

export function createPipelineController({ api, store = sessionStore }: PipelineControllerDeps) {
  // Bumped on every ingest and on clearSession, so late ingest answers are dropped.
  const ingestToken: Record<FaceId, number> = { front: 0, back: 0 }

  store.getState().bindWorker(async () => {
    await api.peek()?.clear()
  })

  async function render(faceId: FaceId, rev: number): Promise<void> {
    const state = store.getState()
    const face = state.faces[faceId]
    if (!face || face.rev !== rev) return
    let result
    try {
      result = await api.get().render(faceId, face.quad, face.rotation, state.profileId, rev)
    } catch {
      return // worker crashed; the face keeps its last render
    }
    if (result.ok) store.getState().receiveRender(faceId, result.rev, result.face)
  }

  async function detect(faceId: FaceId): Promise<DetectResult> {
    try {
      return await api.get().detect(faceId)
    } catch {
      return { ok: false, reason: 'detect-failed' }
    }
  }

  function clearSession(): void {
    ingestToken.front++
    ingestToken.back++
    store.getState().clearSession()
  }

  return {
    async ingest(faceId: FaceId, blob: Blob): Promise<IngestResult> {
      const token = ++ingestToken[faceId]
      const result = await api.get().ingest(faceId, blob)
      if (!result.ok) return result
      if (token !== ingestToken[faceId]) {
        result.previewBitmap.close()
        return { ok: false, reason: 'superseded' }
      }
      // Detect before the store sees the face, so step 2 never flashes the default crop.
      const found = await detect(faceId)
      if (token !== ingestToken[faceId]) {
        result.previewBitmap.close()
        return { ok: false, reason: 'superseded' }
      }
      let rev = store.getState().setFace(faceId, result)
      if (found.ok && found.quad && validateQuad(found.quad)) {
        rev = store.getState().setDetectedQuad(faceId, found.quad) ?? rev
      }
      await render(faceId, rev)
      return result
    },
    detect,
    async setQuad(faceId: FaceId, quad: Quad): Promise<void> {
      const rev = store.getState().setQuad(faceId, quad)
      if (rev !== null) await render(faceId, rev)
    },
    async setRotation(faceId: FaceId, rotation: Rotation): Promise<void> {
      const rev = store.getState().setRotation(faceId, rotation)
      if (rev !== null) await render(faceId, rev)
    },
    async resetQuad(faceId: FaceId): Promise<void> {
      const rev = store.getState().resetQuad(faceId)
      if (rev !== null) await render(faceId, rev)
    },
    async setProfile(profileId: string): Promise<void> {
      const revs = store.getState().setProfile(profileId)
      await Promise.all(
        (Object.keys(revs) as FaceId[]).map((faceId) => render(faceId, revs[faceId]!)),
      )
    },
    async buildPdf(copies: 1 | 2): Promise<PdfResult> {
      const { faces, profileId } = store.getState()
      const sheet = sheetLayout(profileId, copies)
      const { front, back } = faces
      if (!sheet.ok || !front || !back) return { ok: false, reason: 'pdf-failed' }
      try {
        return await api.get().buildPdf({
          profileId,
          placements: sheet.placements,
          ruler: sheet.ruler,
          faces: {
            front: { quad: front.quad, rotation: front.rotation },
            back: { quad: back.quad, rotation: back.rotation },
          },
        })
      } catch {
        return { ok: false, reason: 'pdf-failed' }
      }
    },
    clearSession,
  }
}

export type PipelineController = ReturnType<typeof createPipelineController>

/** Clears the in-memory session whenever the page is hidden or discarded. */
export function installPagehideClear(target: EventTarget, controller: Pick<PipelineController, 'clearSession'>): void {
  target.addEventListener('pagehide', () => controller.clearSession())
}
