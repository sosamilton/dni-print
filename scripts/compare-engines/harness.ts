// Runs in Chromium (driven by scripts/compare-engines.ts): scanic needs ImageData and OpenCV.js needs wasm.
import { createOpenCvEngine } from '../../src/engines/opencv-engine.ts'
import { createScanicEngine } from '../../src/engines/scanic-engine.ts'
import type { DetectionEngine } from '../../src/engines/detection-engine.ts'
import { MAX_DETECT_SIDE_PX } from '../../src/worker/processing-api.ts'

export type HarnessOutcome = { status: 'ok'; detected: boolean; ms: number; quad: [number, number][] | null } | { status: 'engine-error' }
export type HarnessResult = Record<string, HarnessOutcome>

const engines: DetectionEngine[] = [createScanicEngine(), createOpenCvEngine()]

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
      row[e.id] = { status: 'ok', detected: quad !== null, ms, quad: quad ? quad.map((p): [number, number] => [p.x * kx, p.y * ky]) : null }
    }
    results.push(row)
  }
  return results
}

;(window as unknown as { runEngines: typeof run }).runEngines = run
