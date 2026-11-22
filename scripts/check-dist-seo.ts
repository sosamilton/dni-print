import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Valor de un atributo de la primera etiqueta que cumple `match`, sin depender del orden de atributos. */
function tagAttr(html: string, tag: string, match: [string, string], attr: string): string | null {
  for (const [raw] of html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))) {
    const attrs = (name: string) => new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(raw)?.[1] ?? null
    if (attrs(match[0]) === match[1]) return attrs(attr)
  }
  return null
}

const ABSOLUTE = /^https:\/\/\S+$/

/**
 * Problems with the SEO surface of the built site (empty = OK).
 * `files` maps the existing dist/ files (`sitemap.xml`, `robots.txt`) to their text.
 */
export function seoProblems(html: string, files: Record<string, string>): string[] {
  const problems: string[] = []
  const canonical = tagAttr(html, 'link', ['rel', 'canonical'], 'href')
  const ogImage = tagAttr(html, 'meta', ['property', 'og:image'], 'content')
  const ogUrl = tagAttr(html, 'meta', ['property', 'og:url'], 'content')
  if (!canonical || !ABSOLUTE.test(canonical)) problems.push('falta <link rel="canonical"> con URL absoluta')
  if (!ogImage || !ABSOLUTE.test(ogImage)) problems.push('falta og:image con URL absoluta')
  if (canonical && ogUrl && canonical !== ogUrl) problems.push('canonical y og:url no coinciden')

  if (!('sitemap.xml' in files)) problems.push('falta dist/sitemap.xml')
  else if (canonical && !files['sitemap.xml'].includes(`<loc>${canonical}</loc>`)) problems.push('sitemap.xml no lista la URL canónica')
  if (!('robots.txt' in files)) problems.push('falta dist/robots.txt')
  else if (!/^Sitemap:\s*https:\/\/\S+\/sitemap\.xml\s*$/im.test(files['robots.txt'])) problems.push('robots.txt no apunta a sitemap.xml')

  const ld = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1]
  if (ld === undefined) problems.push('falta el JSON-LD')
  else {
    try {
      const data = JSON.parse(ld) as { '@type'?: string }
      if (data['@type'] !== 'WebApplication') problems.push('el JSON-LD no es un WebApplication')
    } catch {
      problems.push('el JSON-LD no es JSON válido')
    }
  }

  const h1 = (html.match(/<h1\b/gi) ?? []).length
  if (h1 !== 1) problems.push(`debe haber un solo <h1> (hay ${h1})`)
  if (!/<html\b[^>]*\blang=["']es-AR["']/i.test(html)) problems.push('falta lang="es-AR"')
  if (/%(CANONICAL_URL|OG_IMAGE_URL)%/.test(html)) problems.push('quedaron marcadores sin reemplazar')
  return problems
}

function main(): number {
  const dist = resolve(process.env.DIST_DIR || 'dist')
  const index = resolve(dist, 'index.html')
  if (!existsSync(index)) {
    console.error('No hay dist/index.html: corré `npm run build` primero.')
    return 1
  }
  const files: Record<string, string> = {}
  for (const f of ['sitemap.xml', 'robots.txt']) if (existsSync(resolve(dist, f))) files[f] = readFileSync(resolve(dist, f), 'utf8')
  const problems = seoProblems(readFileSync(index, 'utf8'), files)
  for (const p of problems) console.error(`SEO: ${p}`)
  if (problems.length === 0) console.info('SEO OK: canonical, og:image, sitemap y robots presentes.')
  return problems.length === 0 ? 0 : 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main()
