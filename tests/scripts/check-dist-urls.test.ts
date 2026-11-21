import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findUrls, isAllowedUrl, type UrlRule } from '../../scripts/check-dist-urls.ts'
import { gitFromCli, resolveBuildInfo } from '../../scripts/build-info.ts'

const rules = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', 'scripts', 'dist-url-allowlist.json'), 'utf8'),
) as UrlRule[]

describe('findUrls', () => {
  it('extracts URLs from minified JS, HTML attributes and prose', () => {
    const text = [
      'S(`http://www.w3.org/2000/svg`,i);t=`https://react.dev/errors/`+e',
      '<svg xmlns="http://www.w3.org/2000/svg">',
      'Copyright (https://github.com/JetBrains/JetBrainsMono), see http://scripts.sil.org/OFL.',
    ].join('\n')
    expect(findUrls(text)).toEqual([
      'http://www.w3.org/2000/svg',
      'https://react.dev/errors/',
      'http://www.w3.org/2000/svg',
      'https://github.com/JetBrains/JetBrainsMono',
      'http://scripts.sil.org/OFL',
    ])
  })

  it('finds nothing in text without URLs', () => {
    expect(findUrls('const a = "/fonts/x.woff2"')).toEqual([])
  })
})

describe('isAllowedUrl', () => {
  it('allows exact rules only for the exact URL', () => {
    expect(isAllowedUrl('http://www.w3.org/2000/svg', rules, null)).toBe(true)
    expect(isAllowedUrl('http://www.w3.org/2000/svg/evil', rules, null)).toBe(false)
  })

  it('allows prefix rules', () => {
    expect(isAllowedUrl('https://react.dev/errors/123', rules, null)).toBe(true)
    expect(isAllowedUrl('https://react.dev/learn', rules, null)).toBe(false)
  })

  it('allows the repository URL resolved by the build, without listing it', () => {
    const { repoUrl } = resolveBuildInfo({ VITE_REPO_URL: 'https://github.com/o/r' }, gitFromCli())
    expect(isAllowedUrl('https://github.com/o/r', rules, repoUrl)).toBe(true)
    expect(isAllowedUrl('https://github.com/o/r/tree/abc', rules, repoUrl)).toBe(true)
    expect(isAllowedUrl('https://github.com/o/r/releases/download/x', rules, repoUrl)).toBe(false)
    expect(isAllowedUrl('https://github.com/o/r/raw/main/x.wasm', rules, repoUrl)).toBe(false)
    expect(isAllowedUrl('https://github.com/o/r-evil', rules, repoUrl)).toBe(false)
    expect(isAllowedUrl('https://github.com/o/r', rules, null)).toBe(false)
  })

  it('never matches a rule with an unknown match kind or an empty url', () => {
    const typo = [{ url: 'https://cdn.example.com/', match: 'prefx', reason: 'typo' }] as unknown as UrlRule[]
    expect(isAllowedUrl('https://cdn.example.com/x.js', typo, null)).toBe(false)
    const empty: UrlRule[] = [{ url: '', match: 'prefix', reason: 'empty' }]
    expect(isAllowedUrl('https://cdn.example.com/x.js', empty, null)).toBe(false)
  })

  it('rejects anything else, such as a CDN', () => {
    expect(isAllowedUrl('https://cdn.jsdelivr.net/x.wasm', rules, null)).toBe(false)
  })
})

describe('check:dist script', () => {
  const script = join(import.meta.dirname, '..', '..', 'scripts', 'check-dist-urls.ts')

  it.each([
    ['empty', true],
    ['missing', false],
  ])('fails with a hint to build first when dist is %s', (_label, create) => {
    const base = mkdtempSync(join(tmpdir(), 'check-dist-'))
    const distDir = create ? base : join(base, 'nope')
    try {
      const run = spawnSync(process.execPath, [script], {
        env: { ...process.env, DIST_DIR: distDir },
        encoding: 'utf8',
      })
      expect(run.status).toBe(1)
      expect(run.stderr).toContain('corré `npm run build` primero')
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  })

  function runOnDist(files: Record<string, string>, env: Record<string, string> = {}) {
    const distDir = mkdtempSync(join(tmpdir(), 'check-dist-'))
    try {
      for (const [name, content] of Object.entries(files)) {
        mkdirSync(join(distDir, name, '..'), { recursive: true })
        writeFileSync(join(distDir, name), content)
      }
      return spawnSync(process.execPath, [script], {
        env: { ...process.env, DIST_DIR: distDir, ...env },
        encoding: 'utf8',
      })
    } finally {
      rmSync(distDir, { recursive: true, force: true })
    }
  }

  it('fails naming the file and the URL outside the allowlist', () => {
    const run = runOnDist({ 'assets/app.js': 'load("https://cdn.example.com/x.js")' })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('app.js')
    expect(run.stderr).toContain('https://cdn.example.com/x.js')
  })

  it('passes with allowlisted URLs and the source link of the configured repo', () => {
    const run = runOnDist(
      {
        'assets/app.js':
          'S(`http://www.w3.org/2000/svg`);t=`https://react.dev/errors/`+e;u="https://github.com/o/r/tree/abc"',
      },
      { VITE_REPO_URL: 'https://github.com/o/r' },
    )
    expect(run.status).toBe(0)
  })
})
