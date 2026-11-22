// `npm run compare-engines`: runs the detection adapters in Chromium over corpus/ (or tests/fixtures/)
// and writes docs/engine-comparison.md. Everything is local; the report carries no names, paths or pixels.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { extractDecision, renderReport } from './compare-engines-lib.ts'
import { runComparison } from './compare-engines-runner.ts'

async function main(): Promise<number> {
  const root = resolve(import.meta.dirname, '..')
  const comparison = await runComparison(root, console.info)
  if (!comparison) {
    console.error('No hay imágenes en corpus/ ni en tests/fixtures/: no se escribe el reporte.')
    return 1
  }
  const reportPath = join(root, 'docs', 'engine-comparison.md')
  // The «Decisión» section is written by a person (or a story): a new run keeps it.
  const decision = existsSync(reportPath) ? extractDecision(readFileSync(reportPath, 'utf8')) : null
  mkdirSync(join(root, 'docs'), { recursive: true })
  writeFileSync(reportPath, renderReport(comparison.results, comparison.source, new Date().toLocaleDateString('sv'), decision ?? undefined))
  console.info('Escrito docs/engine-comparison.md')
  return 0
}

process.exitCode = await main()
