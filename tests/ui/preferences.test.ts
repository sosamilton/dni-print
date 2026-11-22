import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, parsePrefs, PREFS_KEY, PREFS_VERSION, serializePrefs, withTheme } from '../../src/ui/preferences.ts'

describe('preferences', () => {
  it('uses a versioned key', () => {
    expect(PREFS_KEY).toBe('dni-print:prefs')
    expect(PREFS_VERSION).toBe(1)
    expect(DEFAULT_PREFS).toEqual({ theme: 'system', whatsapp: '', email: '' })
  })

  it.each([
    ['{"v":1,"theme":"dark"}', 'dark'],
    ['{"v":1,"theme":"light"}', 'light'],
    ['{"v":1,"theme":"system"}', 'system'],
    ['{"v":1}', 'system'],
    ['{"v":1,"theme":"sepia"}', 'system'],
    ['{"v":2,"theme":"dark"}', 'system'],
    ['{"theme":"dark"}', 'system'],
    ['{"v":"1","theme":"dark"}', 'system'],
    ['{v:1', 'system'],
    ['null', 'system'],
    ['[]', 'system'],
    ['"dark"', 'system'],
    ['', 'system'],
  ])('parses %s as %s', (raw, theme) => {
    expect(parsePrefs(raw).theme).toBe(theme)
  })

  it('treats a missing value as the defaults', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS)
  })

  it('serializes Claro and Oscuro, and returns null for Sistema', () => {
    expect(serializePrefs(withTheme(DEFAULT_PREFS, 'dark'))).toBe('{"v":1,"theme":"dark"}')
    expect(serializePrefs(withTheme(DEFAULT_PREFS, 'light'))).toBe('{"v":1,"theme":"light"}')
    expect(serializePrefs(withTheme(DEFAULT_PREFS, 'system'))).toBeNull()
    expect(serializePrefs(DEFAULT_PREFS)).toBeNull()
  })

  it('round-trips', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(parsePrefs(serializePrefs(withTheme(DEFAULT_PREFS, theme)))).toEqual({ ...DEFAULT_PREFS, theme })
    }
  })

  it('keeps a valid whatsapp and email, and drops invalid ones', () => {
    const ok = parsePrefs('{"v":1,"whatsapp":"011 15 2345-6789","email":"a@b.com"}')
    expect(ok).toEqual({ theme: 'system', whatsapp: '011 15 2345-6789', email: 'a@b.com' })
    expect(parsePrefs('{"v":1,"whatsapp":"123","email":"mal"}')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('{"v":1,"whatsapp":5,"email":null}')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(serializePrefs(ok))).toEqual(ok)
    expect(serializePrefs({ ...DEFAULT_PREFS, email: 'a@b.com' })).toBe('{"v":1,"email":"a@b.com"}')
    expect(serializePrefs({ ...DEFAULT_PREFS, email: 'mal', whatsapp: '1' })).toBeNull()
  })

  it('withTheme does not mutate', () => {
    const prefs = withTheme(DEFAULT_PREFS, 'dark')
    expect(DEFAULT_PREFS.theme).toBe('system')
    expect(prefs.theme).toBe('dark')
  })
})
