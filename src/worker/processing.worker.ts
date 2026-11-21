// Worker entry: exposes the processing API with comlink; returned bitmaps are transferred.
import * as Comlink from 'comlink'
import type { ProcessingApi } from './api.ts'
import { createImagingBackend } from './imaging-backend.ts'
import { createProcessingApi } from './processing-api.ts'

const api = createProcessingApi(createImagingBackend())

const exposed: ProcessingApi = {
  ...api,
  async ingest(faceId, blob) {
    const result = await api.ingest(faceId, blob)
    return result.ok
      ? Comlink.transfer(result, [result.previewBitmap as unknown as ImageBitmap])
      : result
  },
  async render(faceId, quad, rotation, profileId, rev) {
    const result = await api.render(faceId, quad, rotation, profileId, rev)
    return result.ok ? Comlink.transfer(result, [result.face as unknown as ImageBitmap]) : result
  },
}

Comlink.expose(exposed)
