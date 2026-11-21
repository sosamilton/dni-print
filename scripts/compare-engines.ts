// `npm run compare-engines`: runs both detection adapters in Chromium over corpus/ (or tests/fixtures/)
// and writes docs/engine-comparison.md. Everything is local; the report carries no names, paths or pixels.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { ENGINE_IDS, meanCornerError, parseQuadJson, renderReport } from './compare-engines-lib.ts'
import type { EngineOutcome, ImageResult, ReportSource } from './compare-engines-lib.ts'

// Mirrors the harness result shape (the harness is browser-only and typed by the app project).
type HarnessOutcome =
  | { status: 'ok'; detected: boolean; ms: number; quad: [number, number][] | null; refinedQuad: [number, number][] | null }
  | { status: 'engine-error' }
type HarnessResult = Record<string, HarnessOutcome>

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

function listImages(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((n) => extname(n).toLowerCase() in MIME)
    .sort()
    .map((n) => join(dir, n))
}

async function main(): Promise<number> {
  const root = resolve(import.meta.dirname, '..')
  let source: ReportSource = 'corpus'
  let files = listImages(join(root, 'corpus'))
  if (files.length === 0) {
    source = 'fixtures'
    files = listImages(join(root, 'tests', 'fixtures'))
  }
  if (files.length === 0) {
    console.error('No hay imágenes en corpus/ ni en tests/fixtures/: no se escribe el reporte.')
    return 1
  }
  console.info(`Fuente: ${source}, ${files.length} imagen(es).`)

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
      if (existsSync(gtPath) && !truth) console.warn(`Aviso: la imagen ${i + 1} tiene un .quad.json inválido; se ignora.`)
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

    mkdirSync(join(root, 'docs'), { recursive: true })
    writeFileSync(join(root, 'docs', 'engine-comparison.md'), renderReport(results, source, new Date().toISOString().slice(0, 10)))
    console.info('Escrito docs/engine-comparison.md')
    return 0
  } finally {
    await browser?.close()
    await server.close()
  }
}

process.exitCode = await main()
