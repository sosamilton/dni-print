// core: pure domain logic (geometry, profiles, layout, PDF).
// No React, no DOM, no global state. Must not import from `ui` or `engines`.
export * from './profiles.ts'
export * from './geometry/index.ts'
export * from './layout.ts'
export { applyFilter, FACE_FILTERS, grayPlane, isWatermark, MAX_WATERMARK_CHARS, normalizeWatermark, renderFace, stampFace } from './render-face.ts'
export type { BitmapLike, RasterBackend, FaceFilter, Watermark } from './render-face.ts'
