// worker: contract between the UI and the processing worker.
// `ui` may import this file; the worker may import `core` and `engines`.
export type ProcessingApi = Record<string, never>
