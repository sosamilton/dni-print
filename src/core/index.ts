// core: pure domain logic (geometry, profiles, layout, PDF).
// No React, no DOM, no global state. Must not import from `ui` or `engines`.
export * from './profiles.ts'
export * from './geometry/index.ts'
export * from './layout.ts'
export { renderFace } from './render-face.ts'
export type { BitmapLike, RasterBackend, FaceFilter } from './render-face.ts'
