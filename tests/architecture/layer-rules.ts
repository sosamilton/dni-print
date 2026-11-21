import { posix } from 'node:path'

export type Layer = 'core' | 'engines' | 'worker' | 'ui'

export interface SourceFile {
  /** Repo-relative POSIX path, e.g. `src/core/geometry.ts`. */
  path: string
  source: string
}

export interface LayerViolation {
  file: string
  specifier: string
  from: Layer
  to: Layer
}

const LAYERS: readonly Layer[] = ['core', 'engines', 'worker', 'ui']

/** Imports each layer must never make (allowed: everything else). */
const FORBIDDEN: Record<Layer, readonly Layer[]> = {
  core: ['ui', 'engines', 'worker'],
  ui: ['engines'],
  engines: ['ui', 'worker'],
  worker: ['ui'],
}

/** The only worker modules `ui` may import (the worker contract). */
const UI_ALLOWED_WORKER_PATHS: readonly string[] = ['src/worker/api', 'src/worker/api.ts']

/** Source files directly under `src/` (App.tsx, main.tsx) belong to `ui`. */
const ROOT_UI_FILE = /^src\/[^/]+\.(m|c)?(t|j)sx?$/

const SPECIFIER_PATTERNS: readonly RegExp[] = [
  // import x from '…' / import { a } from '…' / export { a } from '…' / export * from '…'
  /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  // import '…' (side effect)
  /\bimport\s*['"]([^'"]+)['"]/g,
  // import('…') (dynamic)
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // import(`…`) (dynamic, template literal without interpolation)
  /\bimport\s*\(\s*`((?:(?!\$\{)[^`])+)`\s*\)/g,
]

export function extractRelativeSpecifiers(source: string): string[] {
  const specifiers = new Set<string>()
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        specifiers.add(specifier)
      }
    }
  }
  return [...specifiers]
}

export function layerOf(path: string): Layer | null {
  const normalized = posix.normalize(path)
  for (const layer of LAYERS) {
    if (normalized === `src/${layer}` || normalized.startsWith(`src/${layer}/`)) return layer
  }
  return ROOT_UI_FILE.test(normalized) ? 'ui' : null
}

export function findLayerViolations(files: readonly SourceFile[]): LayerViolation[] {
  const violations: LayerViolation[] = []
  for (const file of files) {
    const from = layerOf(file.path)
    if (from === null) continue
    for (const specifier of extractRelativeSpecifiers(file.source)) {
      const target = posix.join(posix.dirname(file.path), specifier)
      const to = layerOf(target)
      if (to === null) continue
      const uiToNonContractWorker =
        from === 'ui' && to === 'worker' && !UI_ALLOWED_WORKER_PATHS.includes(target)
      if (FORBIDDEN[from].includes(to) || uiToNonContractWorker) {
        violations.push({ file: file.path, specifier, from, to })
      }
    }
  }
  return violations
}
