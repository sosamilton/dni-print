// App-wide pipeline singleton; the worker itself is only created on first ingest.
import { createPipelineController, installPagehideClear } from './pipeline-controller.ts'
import { workerApi } from './worker-client.ts'

export const pipeline = createPipelineController({ api: workerApi })

/** Clears the in-memory session whenever the page is hidden or discarded. */
export function startPipeline(): void {
  installPagehideClear(window, pipeline)
}
