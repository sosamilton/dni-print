import { describe, expect, it } from 'vitest'
import { seoProblems } from '../../scripts/check-dist-seo.ts'
import { seoFiles, sharePreview } from '../../vite.config.ts'

const C = 'https://a.github.io/x/'
const html = `<html lang="es-AR"><head><link href="${C}" rel="canonical" /><meta content="${C}" property="og:url" /><meta property="og:image" content="${C}og-image.png" /><script type="application/ld+json">{"@type":"WebApplication"}</script></head><body><h1>x</h1></body></html>`
const files = { 'sitemap.xml': `<urlset><url><loc>${C}</loc></url></urlset>`, 'robots.txt': `Allow: /\nSitemap: ${C}sitemap.xml\n` }

describe('seoProblems', () => {
  it('OK when everything is present (any attribute order)', () => expect(seoProblems(html, files)).toEqual([]))
  it('names what is missing', () => {
    expect(seoProblems(html.replace('canonical', 'x'), files).join()).toContain('canonical')
    expect(seoProblems(html.replace('og:image', 'x'), files).join()).toContain('og:image')
    const { 'sitemap.xml': _s, ...noSitemap } = files
    expect(seoProblems(html, noSitemap).join()).toContain('sitemap.xml')
    const { 'robots.txt': _r, ...noRobots } = files
    expect(seoProblems(html, noRobots).join()).toContain('robots.txt')
  })
  it('flags bad structure', () => {
    expect(seoProblems(html.replace('og:url" />', 'og:url" />').replace(`content="${C}" property`, 'content="https://b/" property'), files).join()).toContain('og:url')
    expect(seoProblems(html.replace('{"@type":"WebApplication"}', '{}'), files).join()).toContain('WebApplication')
    expect(seoProblems(html.replace('{"@type":"WebApplication"}', '{'), files).join()).toContain('JSON')
    expect(seoProblems(html.replace('<h1>x</h1>', '<h1>x</h1><h1>y</h1>'), files).join()).toContain('<h1>')
    expect(seoProblems(html.replace('es-AR', 'es'), files).join()).toContain('es-AR')
    expect(seoProblems(html, { ...files, 'sitemap.xml': '<urlset/>' }).join()).toContain('URL canónica')
    expect(seoProblems(html + '%CANONICAL_URL%', files).join()).toContain('marcadores')
  })
})

describe('plugins de build', () => {
  it('seoFiles emite robots y sitemap con la canónica', () => {
    const emitted: { fileName: string; source: string }[] = []
    const ctx = { emitFile: (f: { fileName: string; source: string }) => emitted.push(f) }
    ;(seoFiles(C) as unknown as { generateBundle: Function }).generateBundle.call(ctx)
    expect(emitted.find((f) => f.fileName === 'robots.txt')?.source).toContain(`Sitemap: ${C}sitemap.xml`)
    expect(emitted.find((f) => f.fileName === 'sitemap.xml')?.source).toContain(`<loc>${C}</loc>`)
  })
  it('sin sitio no emite nada y sharePreview quita canonical y JSON-LD', () => {
    const emitted: unknown[] = []
    ;(seoFiles(null) as unknown as { generateBundle: Function }).generateBundle.call({ emitFile: (f: unknown) => emitted.push(f) })
    expect(emitted).toEqual([])
    const src = '<link rel="canonical" href="%CANONICAL_URL%" />\n<script type="application/ld+json">{"url":"%CANONICAL_URL%"}</script>\n<p>ok</p>'
    const t = (c: string | null) => (sharePreview(c) as unknown as { transformIndexHtml: (h: string) => string }).transformIndexHtml(src)
    expect(t(null)).not.toMatch(/canonical|ld\+json|%/)
    expect(t(C)).toContain(`href="${C}"`)
    expect(t(C)).not.toContain('%')
  })
})
