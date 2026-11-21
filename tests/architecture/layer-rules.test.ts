import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findLayerViolations, type SourceFile } from './layer-rules.ts'

const repoRoot = join(import.meta.dirname, '..', '..')

function readSourceTree(dir: string): SourceFile[] {
  const entries = readdirSync(join(repoRoot, dir), { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && /\.(m|c)?(t|j)sx?$/.test(entry.name))
    .map((entry) => {
      const absolute = join(entry.parentPath, entry.name)
      return {
        path: relative(repoRoot, absolute).split(sep).join('/'),
        source: readFileSync(absolute, 'utf8'),
      }
    })
}

describe('layer rules', () => {
  it('reports core importing ui', () => {
    const violations = findLayerViolations([
      { path: 'src/core/layout.ts', source: "import { strings } from '../ui/x'\n" },
    ])
    expect(violations).toEqual([
      { file: 'src/core/layout.ts', specifier: '../ui/x', from: 'core', to: 'ui' },
    ])
  })

  it('reports core importing engines', () => {
    const violations = findLayerViolations([
      { path: 'src/core/geometry/homography.ts', source: "import type { E } from '../../engines/x.ts'" },
    ])
    expect(violations).toEqual([
      {
        file: 'src/core/geometry/homography.ts',
        specifier: '../../engines/x.ts',
        from: 'core',
        to: 'engines',
      },
    ])
  })

  it('reports ui importing engines via import, export … from, side effect and dynamic import', () => {
    const violations = findLayerViolations([
      {
        path: 'src/ui/camera/camera.tsx',
        source: [
          "import {",
          "  detect,",
          "} from '../../engines/x'",
          "export { scanic } from '../../engines/scanic'",
          "export * from '../../engines/all'",
          "import '../../engines/side-effect'",
          "const lazy = () => import('../../engines/opencv')",
          "const lazyTemplate = () => import(`../../engines/template`)",
          "const dynamic = (name: string) => import(`../../engines/${name}`)",
        ].join('\n'),
      },
    ])
    expect(violations.map((v) => v.specifier).sort()).toEqual([
      '../../engines/all',
      '../../engines/opencv',
      '../../engines/scanic',
      '../../engines/side-effect',
      '../../engines/template',
      '../../engines/x',
    ])
    expect(violations.every((v) => v.from === 'ui' && v.to === 'engines')).toBe(true)
  })

  it('reports bare directory imports of a forbidden layer', () => {
    const cases = [
      { path: 'src/ui/x.ts', source: "import { e } from '../engines'", to: 'engines' },
      { path: 'src/ui/camera/x.ts', source: "import { e } from '../../engines'", to: 'engines' },
      { path: 'src/core/x.ts', source: "import { s } from '../ui'", to: 'ui' },
    ]
    for (const { path, source, to } of cases) {
      const violations = findLayerViolations([{ path, source }])
      expect(violations).toHaveLength(1)
      expect(violations[0].to).toBe(to)
    }
  })

  it('treats files directly under src/ as ui', () => {
    const violations = findLayerViolations([
      { path: 'src/App.tsx', source: "import { detect } from './engines/x'" },
    ])
    expect(violations).toEqual([
      { file: 'src/App.tsx', specifier: './engines/x', from: 'ui', to: 'engines' },
    ])
  })

  it('reports engines→ui, core→worker and ui→non-contract worker files', () => {
    const violations = findLayerViolations([
      { path: 'src/engines/scanic.ts', source: "import { strings } from '../ui/strings.es.ts'" },
      { path: 'src/core/pdf.ts', source: "import type { ProcessingApi } from '../worker/api'" },
      { path: 'src/ui/x.ts', source: "import '../worker/processing.worker.ts'" },
    ])
    expect(violations.map(({ from, to }) => `${from}->${to}`)).toEqual([
      'engines->ui',
      'core->worker',
      'ui->worker',
    ])
  })

  it('allows the permitted directions and npm packages', () => {
    const violations = findLayerViolations([
      { path: 'src/ui/preview/preview.tsx', source: "import { layout } from '../../core/layout'\nimport type { ProcessingApi } from '../../worker/api'\nimport { create } from 'zustand'" },
      { path: 'src/worker/processing.worker.ts', source: "import { a } from '../core/a'\nimport { b } from '../engines/b'\nimport type { ProcessingApi } from './api'\nimport * as Comlink from 'comlink'" },
      { path: 'src/engines/scanic.ts', source: "import type { Quad } from '../core/geometry'" },
      { path: 'src/core/pdf.ts', source: "import { jsPDF } from 'jspdf'\nimport { profiles } from './profiles'" },
      { path: 'src/App.tsx', source: "import { strings } from './ui/strings.es.ts'" },
    ])
    expect(violations).toEqual([])
  })

  it('finds no violations in the real src/ tree', () => {
    const files = readSourceTree('src')
    expect(files.length).toBeGreaterThan(0)
    expect(findLayerViolations(files)).toEqual([])
  })
})
