import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { parsePrefs, PREFS_KEY } from '../../src/ui/preferences.ts'
import { DARK_THEME_COLOR, FakeElement, fakeDocument, fakeStorage, LIGHT_THEME_COLOR, throwingStorage } from './theme-fake-dom.ts'

const root = join(import.meta.dirname, '..', '..')
const script = readFileSync(join(root, 'public', 'theme-boot.js'), 'utf8')

function boot(raw: string | null | undefined, storage?: unknown) {
  const dom = fakeDocument()
  const store = storage ?? fakeStorage(raw == null ? {} : { [PREFS_KEY]: raw })
  const window = { get localStorage() { return store } }
  expect(() => runInNewContext(script, { window, document: dom.doc })).not.toThrow()
  return dom
}

const CASES: (string | null)[] = [
  '{"v":1,"theme":"dark"}',
  '{"v":1,"theme":"light"}',
  '{"v":1,"theme":"system"}',
  '{"v":1}',
  '{"v":1,"theme":"sepia"}',
  '{"v":2,"theme":"dark"}',
  '{"v":"1","theme":"dark"}',
  '{"theme":"dark"}',
  '{v:1',
  'null',
  '[]',
  '"dark"',
  '',
  null,
]

describe('public/theme-boot.js', () => {
  it('is a classic script with no imports, using the same key as preferences.ts', () => {
    expect(script).not.toMatch(/^\s*(import|export)\b/m)
    expect(script).toContain(`'${PREFS_KEY}'`)
  })

  it.each(CASES)('agrees with parsePrefs for %s', (raw) => {
    const { documentElement } = boot(raw)
    const theme = parsePrefs(raw).theme
    expect(documentElement.getAttribute('data-theme')).toBe(theme === 'system' ? null : theme)
  })

  it('points both theme-color metas at the dark color and keeps the originals', () => {
    const { metas } = boot('{"v":1,"theme":"dark"}')
    expect(metas.map((m) => m.getAttribute('content'))).toEqual([DARK_THEME_COLOR, DARK_THEME_COLOR])
    expect(metas.map((m) => m.getAttribute('data-content'))).toEqual([LIGHT_THEME_COLOR, DARK_THEME_COLOR])
  })

  it('points both theme-color metas at the light color with Claro', () => {
    const { metas } = boot('{"v":1,"theme":"light"}')
    expect(metas.map((m) => m.getAttribute('content'))).toEqual([LIGHT_THEME_COLOR, LIGHT_THEME_COLOR])
  })

  it('leaves theme-color untouched with Sistema', () => {
    const { metas } = boot(null)
    expect(metas.map((m) => m.getAttribute('content'))).toEqual([LIGHT_THEME_COLOR, DARK_THEME_COLOR])
    expect(metas.every((m) => !m.hasAttribute('data-content'))).toBe(true)
  })

  it('never throws when localStorage throws (or its getter does)', () => {
    expect(boot(undefined, throwingStorage).documentElement.getAttribute('data-theme')).toBeNull()
    const dom = fakeDocument()
    const window = Object.defineProperty({}, 'localStorage', {
      get() {
        throw new Error('SecurityError')
      },
    })
    expect(() => runInNewContext(script, { window, document: dom.doc })).not.toThrow()
    expect(dom.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('the fake theme-color metas match the real ones in index.html', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    const real = [...html.matchAll(/<meta\b[^>]*name="theme-color"[^>]*>/g)].map((m) => ({
      content: /content="([^"]*)"/.exec(m[0])?.[1],
      media: /media="([^"]*)"/.exec(m[0])?.[1],
    }))
    const fake = fakeDocument().metas.map((m: FakeElement) => ({ content: m.getAttribute('content'), media: m.getAttribute('media') }))
    expect(real).toEqual(fake)
  })

  it('is loaded from index.html after the theme-color metas, as a same-origin classic script', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    const tag = '<script src="/theme-boot.js"></script>'
    expect(html).toContain(tag)
    expect(html.indexOf(tag)).toBeGreaterThan(html.lastIndexOf('name="theme-color"'))
    expect(html.indexOf(tag)).toBeLessThan(html.indexOf('<body>'))
  })
})
