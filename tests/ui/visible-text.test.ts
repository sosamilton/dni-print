import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = join(import.meta.dirname, '..', '..')
const srcDir = join(repoRoot, 'src')

function tsxFiles(): string[] {
  return readdirSync(srcDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => join(entry.parentPath, entry.name))
}

function stripNoise(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/=>|>=|<=/g, ' ')
}

/** Literal text between JSX tags, e.g. `<p>Hola</p>`. */
function findLiteralJsxText(source: string): string[] {
  return [...stripNoise(source).matchAll(/>([^<>{}]+)</g)]
    .map((match) => match[1].trim())
    .filter((text) => text.length > 0)
}

/** Literal accessible-name attributes, e.g. `aria-label="Cerrar"`. */
function findLiteralTextAttributes(source: string): string[] {
  return [...stripNoise(source).matchAll(/\b(?:aria-label|title|alt|placeholder)\s*=\s*(['"])[^'"]*\1/g)].map(
    (match) => match[0],
  )
}

describe('visible text detection', () => {
  it('flags literal JSX text and literal labels', () => {
    expect(findLiteralJsxText('<p>Hola</p>')).toEqual(['Hola'])
    expect(findLiteralJsxText('<p>{strings.x}</p>')).toEqual([])
    expect(findLiteralTextAttributes('<b aria-label="Cerrar" />')).toEqual(['aria-label="Cerrar"'])
    expect(findLiteralTextAttributes('<b title={strings.x} />')).toEqual([])
  })
})

describe('src/**/*.tsx', () => {
  const files = tsxFiles()

  it('exist', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const name = relative(repoRoot, file).split(sep).join('/')
    it(`${name} takes every visible text from strings.es.ts`, () => {
      const source = readFileSync(file, 'utf8')
      expect(findLiteralJsxText(source)).toEqual([])
      expect(findLiteralTextAttributes(source)).toEqual([])
    })
  }
})
