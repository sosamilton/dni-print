import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { engineCsp, precacheOptions, stripCspInDev } from '../../vite.config.ts'
import { AD7_CSP } from '../csp-policy.ts'

const indexHtml = readFileSync(join(import.meta.dirname, '..', '..', 'index.html'), 'utf8')

describe('Content-Security-Policy (AD-7)', () => {
  const metas = [...indexHtml.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0])
  const cspMetas = metas.filter((meta) => /http-equiv=["']?Content-Security-Policy["']?/i.test(meta))

  it('declares exactly one CSP meta with the AD-7 policy', () => {
    expect(cspMetas).toHaveLength(1)
    expect(/content="([^"]*)"/.exec(cspMetas[0])?.[1]).toBe(AD7_CSP)
  })

  it('places it right after <meta charset>', () => {
    expect(metas[0]).toMatch(/charset=/i)
    expect(metas[1]).toBe(cspMetas[0])
    const head = indexHtml.slice(indexHtml.indexOf('<head>') + '<head>'.length, indexHtml.indexOf(metas[1]))
    expect(head.trim()).toBe(metas[0])
  })
})

describe('strip-csp-in-dev plugin', () => {
  const plugin = stripCspInDev()
  const transform = plugin.transformIndexHtml as (html: string) => string

  it('only applies to the dev server', () => {
    expect(plugin.apply).toBe('serve')
  })

  it('removes the CSP meta from index.html and keeps the other metas', () => {
    const html = transform(indexHtml)
    expect(html).not.toMatch(/Content-Security-Policy/i)
    expect(html).toMatch(/<meta charset="UTF-8" \/>/)
    expect(html).toMatch(/<meta name="viewport"/)
  })

  it('does not depend on attribute order or quote style', () => {
    const variant = `<head>\n  <meta content="default-src 'self'" http-equiv='Content-Security-Policy'>\n</head>`
    expect(transform(variant)).not.toMatch(/Content-Security-Policy/i)
  })
})

describe('engine-csp plugin', () => {
  const run = (id: string) => (engineCsp(id).transformIndexHtml as (html: string) => string)(indexHtml)
  const cspOf = (html: string) => /http-equiv="?Content-Security-Policy"?[^>]*content="([^"]*)"/i.exec(html)?.[1]

  it('leaves AD-7 identical for scanic', () => {
    expect(run('scanic')).toBe(indexHtml)
  })

  it("adds 'unsafe-eval' to script-src only for opencv", () => {
    expect(cspOf(run('opencv'))).toBe(AD7_CSP.replace("'wasm-unsafe-eval'", "'wasm-unsafe-eval' 'unsafe-eval'"))
  })
})

describe('precacheOptions', () => {
  it('sets 16 MiB for opencv and less for scanic', () => {
    expect(precacheOptions('opencv').maximumFileSizeToCacheInBytes).toBe(16 * 1024 * 1024)
    expect(precacheOptions('scanic').maximumFileSizeToCacheInBytes).toBeLessThan(16 * 1024 * 1024)
  })
})
