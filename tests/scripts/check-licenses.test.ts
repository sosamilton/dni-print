import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  findViolations,
  formatViolation,
  isLicenseAllowed,
  licenseOf,
  productionPackages,
  type LicenseException,
} from '../../scripts/check-licenses.ts'

const PAKO_EXCEPTION: LicenseException = {
  package: 'pako',
  version: '2.2.0',
  license: '(MIT AND Zlib)',
  reason: 'test',
}

describe('isLicenseAllowed', () => {
  it.each(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'AGPL-3.0', 'GPL-3.0'])('allows %s', (id) => {
    expect(isLicenseAllowed(id)).toBe(true)
  })

  it.each(['AGPL-3.0-only', 'AGPL-3.0-or-later', 'AGPL-3.0+', 'GPL-3.0-only', 'GPL-3.0-or-later', 'GPL-3.0+'])(
    'allows the GPL-family variant %s',
    (id) => {
      expect(isLicenseAllowed(id)).toBe(true)
    },
  )

  it.each(['MPL-2.0', 'Zlib', 'GPL-2.0', 'LGPL-3.0', 'UNLICENSED', 'MIT-only', 'Apache-2.0+'])('rejects %s', (id) => {
    expect(isLicenseAllowed(id)).toBe(false)
  })

  it('passes an OR when any branch passes', () => {
    expect(isLicenseAllowed('(MPL-2.0 OR Apache-2.0)')).toBe(true)
    expect(isLicenseAllowed('MIT OR SEE LICENSE IN FEEL-FREE.md')).toBe(true)
    expect(isLicenseAllowed('(MPL-2.0 OR Zlib)')).toBe(false)
  })

  it('passes an AND only when every branch passes', () => {
    expect(isLicenseAllowed('(MIT AND Zlib)')).toBe(false)
    expect(isLicenseAllowed('MIT AND ISC')).toBe(true)
  })

  it('respects parentheses and AND precedence over OR', () => {
    expect(isLicenseAllowed('Zlib AND MPL-2.0 OR MIT')).toBe(true)
    expect(isLicenseAllowed('Zlib AND (MPL-2.0 OR MIT)')).toBe(false)
    expect(isLicenseAllowed('((MIT))')).toBe(true)
  })

  it('never passes WITH, SEE LICENSE IN, unknown or missing values', () => {
    expect(isLicenseAllowed('GPL-3.0-only WITH Classpath-exception-2.0')).toBe(false)
    expect(isLicenseAllowed('SEE LICENSE IN LICENSE.txt')).toBe(false)
    expect(isLicenseAllowed('Custom')).toBe(false)
    expect(isLicenseAllowed('')).toBe(false)
    expect(isLicenseAllowed(null)).toBe(false)
    expect(isLicenseAllowed(undefined)).toBe(false)
  })

  it('rejects malformed expressions', () => {
    expect(isLicenseAllowed('(MIT')).toBe(false)
    expect(isLicenseAllowed('MIT)')).toBe(false)
    expect(isLicenseAllowed('MIT OR')).toBe(false)
    expect(isLicenseAllowed('MIT ISC')).toBe(false)
  })
})

describe('licenseOf', () => {
  it('reads the license string', () => {
    expect(licenseOf({ license: 'MIT' })).toBe('MIT')
  })

  it('reads the legacy object and array forms as an OR', () => {
    expect(licenseOf({ license: { type: 'ISC' } })).toBe('ISC')
    expect(licenseOf({ licenses: [{ type: 'MIT' }] })).toBe('MIT')
    expect(licenseOf({ licenses: [{ type: 'MPL-2.0' }, { type: 'Apache-2.0' }] })).toBe('MPL-2.0 OR Apache-2.0')
    expect(isLicenseAllowed(licenseOf({ licenses: [{ type: 'MPL-2.0' }, { type: 'Apache-2.0' }] }))).toBe(true)
  })

  it('returns null when no license is declared', () => {
    expect(licenseOf({})).toBeNull()
    expect(licenseOf({ license: '' })).toBeNull()
    expect(licenseOf({ licenses: [] })).toBeNull()
    expect(licenseOf(null)).toBeNull()
  })
})

describe('productionPackages', () => {
  it('keeps node_modules entries not marked dev, including devOptional', () => {
    const lock = {
      packages: {
        '': { name: 'root' },
        'node_modules/react': { version: '19.3.1' },
        'node_modules/vite': { version: '8.3.8', dev: true },
        'node_modules/csstype': { version: '3.2.4', devOptional: true },
        'node_modules/@scope/pkg': { version: '1.0.0', optional: true },
        'node_modules/a/node_modules/b': { version: '2.0.0' },
      },
    }
    expect(productionPackages(lock)).toEqual([
      { path: 'node_modules/react', name: 'react', version: '19.3.1', optional: false },
      { path: 'node_modules/csstype', name: 'csstype', version: '3.2.4', optional: false },
      { path: 'node_modules/@scope/pkg', name: '@scope/pkg', version: '1.0.0', optional: true },
      { path: 'node_modules/a/node_modules/b', name: 'b', version: '2.0.0', optional: false },
    ])
  })
})

describe('findViolations', () => {
  it('flags an AND with a non-allowed branch unless a matching exception exists', () => {
    const pako = { name: 'pako', version: '2.2.0', license: '(MIT AND Zlib)' }
    expect(findViolations([pako], [])).toEqual([pako])
    expect(findViolations([pako], [PAKO_EXCEPTION])).toEqual([])
    expect(formatViolation(pako)).toBe('pako@2.2.0: (MIT AND Zlib)')
  })

  it('does not apply an exception to another version or license', () => {
    const newer = { name: 'pako', version: '2.3.0', license: '(MIT AND Zlib)' }
    const relicensed = { name: 'pako', version: '2.2.0', license: 'Zlib' }
    expect(findViolations([newer, relicensed], [PAKO_EXCEPTION])).toEqual([newer, relicensed])
  })

  it('flags packages without a license', () => {
    const bare = { name: 'bare', version: '1.0.0', license: null }
    expect(findViolations([bare], [])).toEqual([bare])
    expect(formatViolation(bare)).toBe('bare@1.0.0: (sin licencia)')
  })

  it('passes allowed licenses', () => {
    expect(findViolations([{ name: 'react', version: '19.3.1', license: 'MIT' }], [])).toEqual([])
  })
})

describe('check:licenses script', () => {
  const script = join(import.meta.dirname, '..', '..', 'scripts', 'check-licenses.ts')
  const fixtures: string[] = []

  afterEach(() => {
    for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  interface FixturePackage {
    name: string
    version: string
    license?: string
    dev?: boolean
    optional?: boolean
    installed?: boolean
  }

  /** Temp project with a package-lock.json and the installed node_modules/<name>/package.json files. */
  function fixture(packages: FixturePackage[]): string {
    const root = mkdtempSync(join(tmpdir(), 'check-licenses-'))
    fixtures.push(root)
    const lockPackages: Record<string, unknown> = { '': { name: 'fixture' } }
    for (const pkg of packages) {
      const path = `node_modules/${pkg.name}`
      lockPackages[path] = { version: pkg.version, dev: pkg.dev, optional: pkg.optional }
      if (pkg.installed === false) continue
      mkdirSync(join(root, path), { recursive: true })
      writeFileSync(
        join(root, path, 'package.json'),
        JSON.stringify({ name: pkg.name, version: pkg.version, license: pkg.license }),
      )
    }
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: lockPackages }))
    return root
  }

  function run(cwd: string) {
    return spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' })
  }

  it('fails listing a disallowed production package', () => {
    const result = run(fixture([{ name: 'bad', version: '1.0.0', license: 'MPL-2.0' }]))
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('bad@1.0.0: MPL-2.0')
  })

  it('ignores dev packages and skips optional packages that are not installed', () => {
    const result = run(
      fixture([
        { name: 'ok', version: '1.0.0', license: 'MIT' },
        { name: 'dev-bad', version: '1.0.0', license: 'MPL-2.0', dev: true },
        { name: 'opt-missing', version: '1.0.0', license: 'MPL-2.0', optional: true, installed: false },
      ]),
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/Licencias OK: 1 /)
  })

  it('fails when a non-optional production package is not installed', () => {
    const result = run(
      fixture([
        { name: 'ok', version: '1.0.0', license: 'MIT' },
        { name: 'missing', version: '2.0.0', license: 'MIT', installed: false },
      ]),
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('missing@2.0.0')
  })

  it('fails when no production package was checked', () => {
    const result = run(fixture([{ name: 'opt', version: '1.0.0', optional: true, installed: false }]))
    expect(result.status).toBe(1)
  })

  it('passes when every production package is allowed', () => {
    const result = run(
      fixture([
        { name: 'a', version: '1.0.0', license: 'MIT' },
        { name: 'b', version: '1.0.0', license: '(MPL-2.0 OR Apache-2.0)' },
      ]),
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/Licencias OK: [1-9]\d* /)
  })
})
