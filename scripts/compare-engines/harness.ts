// Runs in Chromium (driven by scripts/compare-engines.ts): scanic needs ImageData and OpenCV.js needs wasm.
import { createCardFitEngine } from '../../src/engines/cardfit-engine.ts'
import { createOpenCvEngine } from '../../src/engines/opencv-engine.ts'
import { createScanicEngine } from '../../src/engines/scanic-engine.ts'
import type { DetectionEngine } from '../../src/engines/detection-engine.ts'
import { refineQuad } from '../../src/core/geometry/refine.ts'
import type { Quad } from '../../src/core/geometry/types.ts'
import { MAX_DETECT_SIDE_PX, MAX_SOURCE_SIDE_PX } from '../../src/worker/processing-api.ts'

export type HarnessOutcome =
  | { status: 'ok'; detected: boolean; ms: number; quad: [number, number][] | null; refinedQuad: [number, number][] | null }
  | { status: 'engine-error' }
export type HarnessResult = Record<string, HarnessOutcome>

const engines: DetectionEngine[] = [createCardFitEngine(), createScanicEngine(), createOpenCvEngine()]

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function run(images: { base64: string; mime: string }[]): Promise<HarnessResult[]> {
  const ready = new Map<string, boolean>()
  for (const e of engines) {
    try {
      await e.init()
      ready.set(e.id, true)
    } catch {
      ready.set(e.id, false)
    }
  }
  const results: HarnessResult[] = []
  const warmed = new Set<string>()
  for (const img of images) {
    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmap(new Blob([fromBase64(img.base64)], { type: img.mime }), { imageOrientation: 'from-image' })
    } catch {
      // A corrupt file must not discard the rest of the corpus.
      results.push(Object.fromEntries(engines.map((e) => [e.id, { status: 'engine-error' } as HarnessOutcome])))
      continue
    }
    const k = Math.min(1, MAX_DETECT_SIDE_PX / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * k))
    const h = Math.max(1, Math.round(bitmap.height * k))
    const ctx = new OffscreenCanvas(w, h).getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0, w, h)
    const pixels = ctx.getImageData(0, 0, w, h)
    const kx = bitmap.width / w
    const ky = bitmap.height / h
    // The worker refines on its source bitmap, capped like ingest (long side ≤ MAX_SOURCE_SIDE_PX).
    const ks = Math.min(1, MAX_SOURCE_SIDE_PX / Math.max(bitmap.width, bitmap.height))
    const fw = Math.max(1, Math.round(bitmap.width * ks))
    const fh = Math.max(1, Math.round(bitmap.height * ks))
    const fullCtx = new OffscreenCanvas(fw, fh).getContext('2d')
    if (!fullCtx) throw new Error('no 2d context')
    fullCtx.imageSmoothingQuality = 'high'
    fullCtx.drawImage(bitmap, 0, 0, fw, fh)
    const full = fullCtx.getImageData(0, 0, fw, fh)
    // Source px per worker-source px, to report the refined quad like the unrefined one.
    const backX = bitmap.width / fw
    const backY = bitmap.height / fh
    bitmap.close()
    const row: HarnessResult = {}
    for (const e of engines) {
      if (!ready.get(e.id)) {
        row[e.id] = { status: 'engine-error' }
        continue
      }
      // Fresh copy: an engine must not see another's mutations.
      const copy = new ImageData(new Uint8ClampedArray(pixels.data), w, h)
      if (!warmed.has(e.id)) {
        // One untimed run per engine so JIT/wasm warm-up does not inflate the first image's time.
        warmed.add(e.id)
        await e.detect(new ImageData(new Uint8ClampedArray(pixels.data), w, h)).catch(() => null)
      }
      let quad
      const t0 = performance.now()
      try {
        quad = await e.detect(copy)
      } catch {
        row[e.id] = { status: 'engine-error' }
        continue
      }
      const ms = performance.now() - t0
      const scaled = quad ? (quad.map((p) => ({ x: p.x * kx, y: p.y * ky })) as Quad) : null
      const inWorker = quad ? (quad.map((p) => ({ x: (p.x * kx) / backX, y: (p.y * ky) / backY })) as Quad) : null
      const refinedInWorker = inWorker ? refineQuad(full, inWorker) : null
      const refined = refinedInWorker
        ? refinedInWorker === inWorker
          ? scaled
          : (refinedInWorker.map((p) => ({ x: p.x * backX, y: p.y * backY })) as Quad)
        : null
      const toPairs = (q: Quad | null) => (q ? q.map((p): [number, number] => [p.x, p.y]) : null)
      row[e.id] = { status: 'ok', detected: quad !== null, ms, quad: toPairs(scaled), refinedQuad: toPairs(refined) }
    }
    results.push(row)
  }
  return results
}

;(window as unknown as { runEngines: typeof run }).runEngines = run
