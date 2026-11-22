import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { canonicalUrl, gitFromCli, resolveBase, resolveBuildInfo, resolveSiteUrl } from './build-info.ts'

export interface UrlRule {
  url: string
  match: 'exact' | 'prefix'
  reason: string
}

const URL_PATTERN = /https?:\/\/[^\s"'`<>()[\]{}\\^|]+/gi
const TRAILING_PUNCTUATION = /[.,;:!?]+$/

/** Every `http(s)://` URL in a text, without trailing sentence punctuation. */
export function findUrls(text: string): string[] {
  return [...text.matchAll(URL_PATTERN)].map((match) => match[0].replace(TRAILING_PUNCTUATION, ''))
}

function matchesRule(url: string, rule: UrlRule): boolean {
  if (typeof rule.url !== 'string' || !rule.url) return false
  if (rule.match === 'exact') return url === rule.url
  if (rule.match === 'prefix') return url.startsWith(rule.url)
  return false
}

/** True when the URL matches a rule, is the build's repository URL (or its `/tree/…` link) or lives under the canonical site URL. */
export function isAllowedUrl(url: string, rules: UrlRule[], repoUrl: string | null, siteUrl: string | null = null): boolean {
  if (siteUrl && url.startsWith(siteUrl)) return true
  if (repoUrl && (url === repoUrl || url.startsWith(`${repoUrl}/tree/`))) return true
  return rules.some((rule) => matchesRule(url, rule))
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

function main(): number {
  const cwd = process.cwd()
  const distDir = resolve(cwd, process.env.DIST_DIR || 'dist')
  const files = existsSync(distDir) && statSync(distDir).isDirectory() ? listFiles(distDir) : []
  if (files.length === 0) {
    console.error(`No hay archivos en ${relative(cwd, distDir) || distDir}: corré \`npm run build\` primero.`)
    return 1
  }

  const rules = JSON.parse(readFileSync(join(import.meta.dirname, 'dist-url-allowlist.json'), 'utf8')) as UrlRule[]
  // Same environment the production build sees (see vite.config.ts).
  const env = { ...loadEnv('production', cwd, ''), ...process.env }
  const { repoUrl } = resolveBuildInfo(env, gitFromCli())
  const siteUrl = canonicalUrl(resolveSiteUrl(env, repoUrl), resolveBase(env.VITE_BASE))

  const violations: string[] = []
  for (const file of files) {
    const urls = new Set(findUrls(readFileSync(file, 'latin1')))
    for (const url of urls) {
      if (!isAllowedUrl(url, rules, repoUrl, siteUrl)) violations.push(`${relative(cwd, file)}: ${url}`)
    }
  }

  if (violations.length > 0) {
    console.error('URLs fuera de la allowlist en el build:')
    for (const violation of violations) console.error(`  - ${violation}`)
    console.error('Si la URL no genera requests (p. ej. un namespace o un texto de licencia), agregala a scripts/dist-url-allowlist.json con su motivo.')
    return 1
  }
  console.info(`URLs OK: ${files.length} archivos revisados en ${relative(cwd, distDir) || distDir}.`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main()
}
