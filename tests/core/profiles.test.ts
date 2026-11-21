import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE_ID, getProfile, PROFILES } from '../../src/core/profiles.ts'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('profiles', () => {
  it('has the argentine profiles at 85.6 x 54 mm', () => {
    expect(getProfile('dni-ar')?.label).toBe('DNI argentino')
    expect(getProfile('licencia-ar')?.label).toBe('Licencia de conducir')
    for (const p of PROFILES) {
      expect(p.widthMm).toBe(85.6)
      expect(p.heightMm).toBe(54)
      expect(p.widthMm).toBeGreaterThanOrEqual(p.heightMm)
    }
    expect(getProfile(DEFAULT_PROFILE_ID)).toBeDefined()
    expect(getProfile('nope')).toBeUndefined()
  })

  it('no source file branches on profile.id', () => {
    const re = /\b(if|switch|case)\b[^\n]*\bprofile\w*\.id\b/
    for (const file of walk('src').filter((f) => /\.tsx?$/.test(f))) {
      expect(re.test(readFileSync(file, 'utf8')), file).toBe(false)
    }
  })
})
