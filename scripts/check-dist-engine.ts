import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type EngineId = 'scanic' | 'opencv'

/** Problems that show the build does not carry exactly the chosen engine (empty = OK). */
export function engineProblems(engine: EngineId, files: Record<string, string>): string[] {
  const names = Object.keys(files)
  const hasOpenCv = names.some((n) => /^opencv-.*\.js$/.test(n))
  const hasScanic = names.some((n) => /^scanic-.*\.js$/.test(n) || /\bscanDocument\b/.test(files[n]))
  if (engine === 'opencv') {
    return [...(hasOpenCv ? [] : ['falta el chunk de OpenCV.js']), ...(hasScanic ? ['el bundle opencv incluye scanic'] : [])]
  }
  return hasOpenCv ? ['el bundle scanic incluye OpenCV.js'] : []
}

function main(): number {
  const engine = (process.env.VITE_DETECTION_ENGINE?.trim() || 'scanic') as EngineId
  const assets = resolve(process.env.DIST_DIR || 'dist', 'assets')
  if (!existsSync(assets)) {
    console.error('No hay dist/assets: corré `npm run build` primero.')
    return 1
  }
  const files: Record<string, string> = {}
  for (const name of readdirSync(assets)) {
    if (name.endsWith('.js')) files[name] = name.startsWith('opencv-') ? '' : readFileSync(join(assets, name), 'utf8')
  }
  const problems = engineProblems(engine, files)
  for (const p of problems) console.error(`Motor ${engine}: ${p}`)
  if (problems.length === 0) console.info(`Motor OK: dist/ lleva solo ${engine}.`)
  return problems.length === 0 ? 0 : 1
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main()
