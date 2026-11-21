import { validateQuad } from '../core/index.ts'
import type { PixelImage, Point, Quad } from '../core/index.ts'
import type { DetectionEngine } from './detection-engine.ts'

/** Minimal structural view of the OpenCV.js API used here (tests inject a fake). */
export interface CvMat {
  delete(): void
  rows: number
  data32S: Int32Array
  intPtr(row: number, col: number): Int32Array
}
export interface CvLike {
  Mat: new (...args: unknown[]) => CvMat
  MatVector: new () => { size(): number; get(i: number): CvMat; delete(): void }
  Size: new (w: number, h: number) => unknown
  matFromImageData(img: unknown): CvMat
  cvtColor(src: CvMat, dst: CvMat, code: number): void
  GaussianBlur(src: CvMat, dst: CvMat, size: unknown, sigma: number): void
  Canny(src: CvMat, dst: CvMat, t1: number, t2: number): void
  dilate(src: CvMat, dst: CvMat, kernel: CvMat): void
  getStructuringElement(shape: number, size: unknown): CvMat
  findContours(src: CvMat, contours: unknown, hierarchy: CvMat, mode: number, method: number): void
  arcLength(c: CvMat, closed: boolean): number
  approxPolyDP(c: CvMat, dst: CvMat, eps: number, closed: boolean): void
  isContourConvex(c: CvMat): boolean
  contourArea(c: CvMat): number
  COLOR_RGBA2GRAY: number
  MORPH_RECT: number
  RETR_EXTERNAL: number
  CHAIN_APPROX_SIMPLE: number
}

export type CvLoader = () => Promise<CvLike>

const MIN_AREA_RATIO = 0.1

/** Loads the bundled single-thread OpenCV.js (wasm embedded) from our own origin; resolved at runtime inside the worker. */
const defaultLoader: CvLoader = async () => {
  const { opencvModule } = await import('./opencv-module.ts')
  // The UMD factory yields a thenable (or the ready module); awaiting handles both.
  return (await opencvModule.ready) as CvLike
}

/** TL, TR, BR, BL from four unordered points (y down). */
function orderCorners(pts: Point[]): Quad {
  const by = (f: (p: Point) => number, dir: 1 | -1) => pts.reduce((a, b) => (f(b) * dir > f(a) * dir ? b : a))
  return [by((p) => p.x + p.y, -1), by((p) => p.y - p.x, -1), by((p) => p.x + p.y, 1), by((p) => p.y - p.x, 1)]
}

function findQuad(cv: CvLike, img: PixelImage, mats: { delete(): void }[]): Quad | null {
  const track = <T extends { delete(): void }>(m: T): T => (mats.push(m), m)
  const src = track(cv.matFromImageData({ data: img.data, width: img.width, height: img.height }))
  const gray = track(new cv.Mat())
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  const blur = track(new cv.Mat())
  cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)
  const edges = track(new cv.Mat())
  cv.Canny(blur, edges, 75, 200)
  const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)))
  const dilated = track(new cv.Mat())
  cv.dilate(edges, dilated, kernel)
  const contours = track(new cv.MatVector())
  const hierarchy = track(new cv.Mat())
  cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

  const minArea = img.width * img.height * MIN_AREA_RATIO
  let best: { area: number; pts: Point[] } | null = null
  for (let i = 0; i < contours.size(); i++) {
    const contour = track(contours.get(i))
    const approx = track(new cv.Mat())
    cv.approxPolyDP(contour, approx, 0.02 * cv.arcLength(contour, true), true)
    if (approx.rows !== 4 || !cv.isContourConvex(approx)) continue
    const area = cv.contourArea(approx)
    if (area < minArea || (best && area <= best.area)) continue
    const d = approx.data32S
    best = { area, pts: [0, 1, 2, 3].map((k) => ({ x: d[k * 2], y: d[k * 2 + 1] })) }
  }
  if (!best) return null
  const quad = orderCorners(best.pts)
  return validateQuad(quad) ? quad : null
}

/** Classical OpenCV.js detector. `load` is injectable so tests need no wasm. */
export function createOpenCvEngine(load: CvLoader = defaultLoader): DetectionEngine {
  let pending: Promise<CvLike> | null = null
  const getCv = (): Promise<CvLike> => {
    if (!pending) {
      pending = load().catch((e) => {
        pending = null // allow a retry after a failure
        throw e
      })
    }
    return pending
  }
  return {
    id: 'opencv',
    async init() {
      await getCv()
    },
    async detect(img: PixelImage): Promise<Quad | null> {
      const mats: { delete(): void }[] = []
      try {
        return findQuad(await getCv(), img, mats)
      } catch {
        return null
      } finally {
        for (const m of mats) {
          try {
            m.delete()
          } catch {
            // already freed
          }
        }
      }
    },
  }
}
