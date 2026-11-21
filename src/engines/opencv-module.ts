// OpenCV.js exports a Promise (CommonJS `module.exports`). Bundler interop would wrap it into a broken
// thenable if it crossed a dynamic `import()` boundary, so it is boxed here and unboxed by the caller.
import cv from '@techstark/opencv-js'

export const opencvModule = { ready: cv as unknown }
