import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
const BASE = '/dni-print/'

/** Root-absolute references (`/x`, not `//host/x`) found in HTML attributes and CSS `url()`. */
function rootAbsolute(refs: string[]): string[] {
  return refs.filter((ref) => ref.startsWith('/') && !ref.startsWith('//'))
}

function htmlRefs(html: string): string[] {
  return [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1])
}

function cssRefs(css: string): string[] {
  return [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((match) => match[1].trim())
}

describe(`vite build with VITE_BASE=${BASE}`, () => {
  let outDir: string
  let build: ReturnType<typeof spawnSync>

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), 'vite-base-'))
    build = spawnSync(process.execPath, [VITE, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'production', VITE_BASE: BASE },
      encoding: 'utf8',
    })
  }, 120_000)

  afterAll(() => {
    if (outDir) rmSync(outDir, { recursive: true, force: true })
  })

  function resolveInOutDir(ref: string): string {
    const path = ref.split(/[?#]/)[0].slice(BASE.length)
    return join(outDir, ...path.split('/').map(decodeURIComponent))
  }

  function expectUnderBaseAndPresent(refs: string[]) {
    for (const ref of rootAbsolute(refs)) {
      expect(ref.startsWith(BASE), `${ref} debería empezar con ${BASE}`).toBe(true)
      expect(existsSync(resolveInOutDir(ref)), `${ref} debería existir en el build`).toBe(true)
    }
  }

  it('builds successfully', () => {
    expect(build.status, String(build.stderr)).toBe(0)
  })

  it('serves scripts, styles and the icon from under the base', () => {
    const refs = htmlRefs(readFileSync(join(outDir, 'index.html'), 'utf8'))
    const absolute = rootAbsolute(refs)
    expect(absolute.some((ref) => ref.endsWith('.js'))).toBe(true)
    expect(absolute.some((ref) => ref.endsWith('.css'))).toBe(true)
    expect(absolute).toContain(`${BASE}favicon.svg`)
    expectUnderBaseAndPresent(refs)
  })

  it('serves the fonts referenced by the CSS from under the base', () => {
    const assets = join(outDir, 'assets')
    const refs = readdirSync(assets)
      .filter((name) => name.endsWith('.css'))
      .flatMap((name) => cssRefs(readFileSync(join(assets, name), 'utf8')))
    expect(rootAbsolute(refs).some((ref) => ref.endsWith('.woff2'))).toBe(true)
    expectUnderBaseAndPresent(refs)
  })
})
