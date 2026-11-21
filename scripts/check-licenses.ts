import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** AD-13 allowlist. GPL-family ids also accept their `-only`, `-or-later` and `+` SPDX variants. */
const ALLOWED_EXACT = ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0']
const ALLOWED_GPL_FAMILY = ['AGPL-3.0', 'GPL-3.0']

const ALLOWED_IDS = new Set(
  [
    ...ALLOWED_EXACT,
    ...ALLOWED_GPL_FAMILY.flatMap((id) => [id, `${id}-only`, `${id}-or-later`, `${id}+`]),
  ].map((id) => id.toLowerCase()),
)

function isAllowedId(id: string): boolean {
  return ALLOWED_IDS.has(id.toLowerCase())
}

function tokenize(expr: string): string[] {
  return expr.replace(/[()]/g, ' $& ').trim().split(/\s+/).filter(Boolean)
}

/**
 * Evaluates an SPDX expression against the allowlist.
 * `OR` passes if any branch passes, `AND` only if all do; `WITH`, `SEE LICENSE IN`,
 * unknown ids, malformed expressions and empty values never pass.
 */
export function isLicenseAllowed(expr: string | null | undefined): boolean {
  if (typeof expr !== 'string' || !expr.trim()) return false
  const tokens = tokenize(expr)
  let pos = 0
  const peek = () => tokens[pos]?.toUpperCase()

  // Every parse function returns null on a syntax error.
  function parseOr(): boolean | null {
    let result = parseAnd()
    while (result !== null && peek() === 'OR') {
      pos++
      const right = parseAnd()
      if (right === null) return null
      result = result || right
    }
    return result
  }

  function parseAnd(): boolean | null {
    let result = parseAtom()
    while (result !== null && peek() === 'AND') {
      pos++
      const right = parseAtom()
      if (right === null) return null
      result = result && right
    }
    return result
  }

  function parseAtom(): boolean | null {
    const token = tokens[pos]
    if (token === undefined) return null
    if (token === '(') {
      pos++
      const inner = parseOr()
      if (inner === null || tokens[pos] !== ')') return null
      pos++
      return inner
    }
    const upper = token.toUpperCase()
    if (upper === ')' || upper === 'AND' || upper === 'OR' || upper === 'WITH') return null
    if (upper === 'SEE' && tokens[pos + 1]?.toUpperCase() === 'LICENSE' && tokens[pos + 2]?.toUpperCase() === 'IN') {
      if (tokens[pos + 3] === undefined) return null
      pos += 4
      return false
    }
    pos++
    if (peek() === 'WITH') {
      pos++
      const exception = tokens[pos]
      if (exception === undefined || exception === '(' || exception === ')') return null
      pos++
      return false
    }
    return isAllowedId(token)
  }

  const result = parseOr()
  return result === true && pos === tokens.length
}

function typeOf(entry: unknown): string | null {
  if (typeof entry === 'string') return entry.trim() || null
  if (entry && typeof entry === 'object' && 'type' in entry && typeof entry.type === 'string') {
    return entry.type.trim() || null
  }
  return null
}

function wrap(expr: string): string {
  return /\s/.test(expr) ? `(${expr})` : expr
}

/**
 * License expression declared by a package.json. Reads `license` (string or legacy
 * `{ type }`) and the legacy `licenses: [{ type }]` array as an `OR` of its types.
 * Returns null when nothing usable is declared.
 */
export function licenseOf(pkgJson: unknown): string | null {
  if (!pkgJson || typeof pkgJson !== 'object') return null
  const pkg = pkgJson as { license?: unknown; licenses?: unknown }
  const license = typeOf(pkg.license)
  if (license) return license
  if (Array.isArray(pkg.licenses)) {
    const types = pkg.licenses.map(typeOf).filter((type): type is string => type !== null)
    if (types.length === 1) return types[0]
    if (types.length > 1) return types.map(wrap).join(' OR ')
  }
  return null
}

export interface LockPackage {
  /** Install path relative to the project root, e.g. `node_modules/a/node_modules/b`. */
  path: string
  name: string
  version: string | null
  /** Marked `optional: true` in the lockfile: may be absent on some platforms. */
  optional: boolean
}

/** Production packages of a lockfile v2/v3: every `node_modules/…` entry not marked `dev: true`. */
export function productionPackages(lock: unknown): LockPackage[] {
  const packages = (lock as { packages?: Record<string, Record<string, unknown>> } | null)?.packages
  if (!packages || typeof packages !== 'object') return []
  const result: LockPackage[] = []
  for (const [path, entry] of Object.entries(packages)) {
    if (!path.startsWith('node_modules/') || !entry || entry.dev === true || entry.link === true) continue
    const derivedName = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)
    result.push({
      path,
      name: typeof entry.name === 'string' ? entry.name : derivedName,
      version: typeof entry.version === 'string' ? entry.version : null,
      optional: entry.optional === true,
    })
  }
  return result
}

export interface LicenseException {
  package: string
  version: string
  license: string
  reason: string
}

export interface InstalledPackage {
  name: string
  version: string | null
  license: string | null
}

/** Packages whose license is not allowed and has no exception matching name, version and license exactly. */
export function findViolations(packages: InstalledPackage[], exceptions: LicenseException[]): InstalledPackage[] {
  return packages.filter(
    (pkg) =>
      !isLicenseAllowed(pkg.license) &&
      !exceptions.some(
        (ex) => ex.package === pkg.name && ex.version === pkg.version && ex.license === pkg.license,
      ),
  )
}

export function formatViolation(pkg: InstalledPackage): string {
  return `${pkg.name}@${pkg.version ?? '(sin versión)'}: ${pkg.license ?? '(sin licencia)'}`
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function main(): number {
  const root = process.cwd()
  const lockPath = join(root, 'package-lock.json')
  if (!existsSync(lockPath)) {
    console.error('No se encontró package-lock.json en el directorio actual.')
    return 1
  }
  const exceptions = readJson(join(import.meta.dirname, 'license-exceptions.json')) as LicenseException[]

  const seen = new Set<string>()
  const installed: InstalledPackage[] = []
  const missing: string[] = []
  for (const lockPkg of productionPackages(readJson(lockPath))) {
    const pkgJsonPath = join(root, lockPkg.path, 'package.json')
    if (!existsSync(pkgJsonPath)) {
      // Optional dependencies may legitimately be absent on this platform.
      if (!lockPkg.optional) missing.push(`${lockPkg.name}@${lockPkg.version ?? '(sin versión)'} (${lockPkg.path})`)
      continue
    }
    const pkgJson = readJson(pkgJsonPath) as { name?: unknown; version?: unknown }
    const pkg: InstalledPackage = {
      name: typeof pkgJson.name === 'string' ? pkgJson.name : lockPkg.name,
      version: typeof pkgJson.version === 'string' ? pkgJson.version : lockPkg.version,
      license: licenseOf(pkgJson),
    }
    const key = `${pkg.name}@${pkg.version}`
    if (seen.has(key)) continue
    seen.add(key)
    installed.push(pkg)
  }

  if (missing.length > 0) {
    console.error('Dependencias de producción no instaladas (corré `npm ci` primero):')
    for (const entry of missing) console.error(`  - ${entry}`)
    return 1
  }
  if (installed.length === 0) {
    console.error('No se revisó ninguna dependencia de producción: corré `npm ci` primero.')
    return 1
  }

  const violations = findViolations(installed, exceptions)
  if (violations.length > 0) {
    console.error('Dependencias de producción con licencia fuera de la allowlist (AD-13) y sin excepción:')
    for (const pkg of violations) console.error(`  - ${formatViolation(pkg)}`)
    console.error('Si la licencia es compatible con AGPL-3.0, agregá una excepción revisada en scripts/license-exceptions.json.')
    return 1
  }
  console.info(`Licencias OK: ${installed.length} dependencias de producción revisadas.`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main()
}
