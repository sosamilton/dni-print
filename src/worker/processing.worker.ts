// Worker entry: exposes the processing API with comlink; returned bitmaps are transferred.
import * as Comlink from 'comlink'
import type { ProcessingApi } from './api.ts'
import { createDetectionEngine } from '../engines/index.ts'
import { createImagingBackend } from './imaging-backend.ts'
import { createProcessingApi } from './processing-api.ts'

// A bad VITE_DETECTION_ENGINE must not take ingest/render/PDF down: detect just reports `detect-failed`.
function safeEngine() {
  try {
    return createDetectionEngine()
  } catch {
    return undefined
  }
}

const api = createProcessingApi(createImagingBackend(), safeEngine())

const exposed: ProcessingApi = {
  ...api,
  async ingest(faceId, blob) {
    const result = await api.ingest(faceId, blob)
    return result.ok
      ? Comlink.transfer(result, [result.previewBitmap as unknown as ImageBitmap])
      : result
  },
  async render(faceId, quad, rotation, profileId, rev, filter, watermark) {
    const result = await api.render(faceId, quad, rotation, profileId, rev, filter, watermark)
    return result.ok ? Comlink.transfer(result, [result.face as unknown as ImageBitmap]) : result
  },
}

Comlink.expose(exposed)
