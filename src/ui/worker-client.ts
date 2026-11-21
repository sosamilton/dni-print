// Lazy worker client: the worker is only created on first use.
import * as Comlink from 'comlink'
import type { ProcessingApi } from '../worker/api.ts'
import type { ApiProvider } from './pipeline-controller.ts'

let api: ProcessingApi | null = null

export const workerApi: ApiProvider = {
  get() {
    if (!api) {
      const worker = new Worker(new URL('../worker/processing.worker.ts', import.meta.url), {
        type: 'module',
      })
      api = Comlink.wrap<ProcessingApi>(worker)
    }
    return api
  },
  peek: () => api,
}
