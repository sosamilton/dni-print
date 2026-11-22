// Runs the detection adapters in Chromium over corpus/ (or tests/fixtures/); shared by `npm run compare-engines`
// and the corpus regression test. Everything is local: nothing leaves the machine.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { ENGINE_IDS, meanCornerError, parseQuadJson } from './compare-engines-lib.ts'
import type { EngineOutcome, ImageResult, ReportSource } from './compare-engines-lib.ts'

// Mirrors the harness result shape (the harness is browser-only and typed by the app project).
type HarnessOutcome =
  | { status: 'ok'; detected: boolean; ms: number; quad: [number, number][] | null; refinedQuad: [number, number][] | null }
  | { status: 'engine-error' }
type HarnessResult = Record<string, HarnessOutcome>

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

export function listImages(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((n) => extname(n).toLowerCase() in MIME)
    .sort()
    .map((n) => join(dir, n))
}

export interface Comparison {
  results: ImageResult[]
  source: ReportSource
}

/** Null when there is no image at all. Throws if Chromium or Vite cannot start. */
export async function runComparison(root: string, log: (m: string) => void = () => {}): Promise<Comparison | null> {
  let source: ReportSource = 'corpus'
  let files = listImages(join(root, 'corpus'))
  if (files.length === 0) {
    source = 'fixtures'
    files = listImages(join(root, 'tests', 'fixtures'))
  }
  if (files.length === 0) return null
  log(`Fuente: ${source}, ${files.length} imagen(es).`)

  const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } })
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch()
    await server.listen()
    const url = server.resolvedUrls?.local[0]
    if (!url) throw new Error('Vite no devolvió una URL local')
    const page = await browser.newPage()
    await page.goto(new URL('scripts/compare-engines/index.html', url).href)
    await page.waitForFunction('typeof runEngines === "function"')
    const payload = files.map((f) => ({ base64: readFileSync(f).toString('base64'), mime: MIME[extname(f).toLowerCase()] }))
    const raw = (await page.evaluate((imgs) => (globalThis as unknown as { runEngines: (i: typeof imgs) => Promise<HarnessResult[]> }).runEngines(imgs), payload))

    const results: ImageResult[] = raw.map((row, i) => {
      const gtPath = files[i].replace(/\.[^.]+$/, '.quad.json')
      const truth = existsSync(gtPath) ? parseQuadJson(readFileSync(gtPath, 'utf8')) : null
      if (existsSync(gtPath) && !truth) log(`Aviso: la imagen ${i + 1} tiene un .quad.json inválido; se ignora.`)
      const out = {} as ImageResult
      for (const id of ENGINE_IDS) {
        const o = row[id]
        out[id] =
          !o || o.status === 'engine-error'
            ? { status: 'engine-error' }
            : ({
                status: 'ok',
                detected: o.detected,
                ms: o.ms,
                error: o.quad && truth ? meanCornerError(o.quad, truth) : null,
                refinedError: o.refinedQuad && truth ? meanCornerError(o.refinedQuad, truth) : null,
              } satisfies EngineOutcome)
      }
      return out
    })
    return { results, source }
  } finally {
    await browser?.close()
    await server.close()
  }
}

export interface OrientationRow {
  file: string
  expected: number
  rotation: number | null
  decidedBy: 'axis' | 'content' | null
  ms: number | null
}

/** Runs the production orientation rule over the annotated corpus (`corpus/orientation.json` + `.quad.json`). Null without them. */
export async function runOrientationCorpus(root: string): Promise<OrientationRow[] | null> {
  const dir = join(root, 'corpus')
  const annotations = join(dir, 'orientation.json')
  if (!existsSync(annotations)) return null
  const truth = JSON.parse(readFileSync(annotations, 'utf8')) as Record<string, { rotation: number }>
  const files = listImages(dir).filter((f) => {
    const name = f.slice(dir.length + 1)
    return name in truth && existsSync(f.replace(/\.[^.]+$/, '.quad.json'))
  })
  if (files.length === 0) return null

  const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } })
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch()
    await server.listen()
    const url = server.resolvedUrls?.local[0]
    if (!url) throw new Error('Vite no devolvió una URL local')
    const page = await browser.newPage()
    await page.goto(new URL('scripts/compare-engines/index.html', url).href)
    await page.waitForFunction('typeof runOrientation === "function"')
    const payload = files.flatMap((f) => {
      const quad = parseQuadJson(readFileSync(f.replace(/\.[^.]+$/, '.quad.json'), 'utf8'))
      return quad ? [{ base64: readFileSync(f).toString('base64'), mime: MIME[extname(f).toLowerCase()], quad }] : []
    })
    const raw = await page.evaluate(
      (imgs) => (globalThis as unknown as { runOrientation: (i: typeof imgs) => Promise<({ rotation: number; decidedBy: 'axis' | 'content'; ms: number } | null)[]> }).runOrientation(imgs),
      payload,
    )
    return files.map((f, i) => ({
      file: f.slice(dir.length + 1),
      expected: truth[f.slice(dir.length + 1)]!.rotation,
      rotation: raw[i]?.rotation ?? null,
      decidedBy: raw[i]?.decidedBy ?? null,
      ms: raw[i]?.ms ?? null,
    }))
  } finally {
    await browser?.close()
    await server.close()
  }
}
