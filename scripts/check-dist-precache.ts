import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Problems with the service worker's precache manifest (empty = OK). */
export function precacheProblems(swSource: string): string[] {
  const urls = [...swSource.matchAll(/url:\s*["']([^"']+)["']/g)].map((m) => m[1])
  if (urls.length === 0) return ['sw.js no tiene lista de precache']
  return urls.some((u) => /(^|\/)(scanic|opencv)-[^/]*\.js$/.test(u)) ? [] : ['el precache de sw.js no lista el chunk del motor (scanic-*/opencv-*)']
}

/** Problems with the web manifest; `fileExists` checks icon paths relative to dist/ (empty = OK). */
export function manifestProblems(manifestJson: string | null, fileExists: (path: string) => boolean): string[] {
  if (manifestJson === null) return ['falta dist/manifest.webmanifest']
  let m: { name?: string; display?: string; icons?: { src?: string }[] }
  try {
    m = JSON.parse(manifestJson)
  } catch {
    return ['manifest.webmanifest no es JSON válido']
  }
  const problems: string[] = []
  if (!m.name) problems.push('el manifest no tiene name')
  if (m.display !== 'standalone') problems.push("el manifest no tiene display 'standalone'")
  if (!m.icons?.length) problems.push('el manifest no tiene íconos')
  for (const icon of m.icons ?? []) {
    if (!icon.src || !fileExists(icon.src)) problems.push(`falta el ícono ${icon.src}`)
  }
  return problems
}

/** `runtimeCaching` shows up as `registerRoute(` calls; only the precache navigation route is allowed. */
export function runtimeCachingProblems(swSource: string): string[] {
  const routes = [...swSource.matchAll(/registerRoute\(\s*([^,)]*)/g)].filter((m) => !/NavigationRoute/.test(m[1]))
  return routes.length ? ['sw.js registra rutas de runtimeCaching'] : []
}

function main(): number {
  const sw = resolve(process.env.DIST_DIR || 'dist', 'sw.js')
  if (!existsSync(sw)) {
    console.error('No hay dist/sw.js: corré `npm run build` primero.')
    return 1
  }
  const dist = resolve(process.env.DIST_DIR || 'dist')
  const manifest = resolve(dist, 'manifest.webmanifest')
  const source = readFileSync(sw, 'utf8')
  const problems = [
    ...precacheProblems(source),
    ...runtimeCachingProblems(source),
    ...manifestProblems(existsSync(manifest) ? readFileSync(manifest, 'utf8') : null, (p) => existsSync(resolve(dist, p))),
  ]
  for (const p of problems) console.error(`Precache: ${p}`)
  if (problems.length === 0) console.info('Precache OK: sw.js lista el chunk del motor.')
  return problems.length === 0 ? 0 : 1
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main()
