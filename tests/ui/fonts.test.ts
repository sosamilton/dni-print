import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = join(import.meta.dirname, '..', '..')
const fontsCss = readFileSync(join(repoRoot, 'src', 'ui', 'styles', 'fonts.css'), 'utf8')
const fontsDir = join(repoRoot, 'public', 'fonts')

const FAMILIES = [
  { name: 'Familjen Grotesk', slug: 'familjen-grotesk' },
  { name: 'Atkinson Hyperlegible', slug: 'atkinson-hyperlegible' },
  { name: 'JetBrains Mono', slug: 'jetbrains-mono' },
]

describe('self-hosted fonts', () => {
  const urls = [...fontsCss.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1])

  it('declares one url per font file, all on the same origin', () => {
    expect(urls).toHaveLength(4)
    for (const url of urls) expect(url).toMatch(/^\/fonts\/[\w-]+\.woff2$/)
  })

  it('points every url at an existing woff2 file in public/fonts/', () => {
    for (const url of urls) {
      const file = join(repoRoot, 'public', url)
      expect(existsSync(file), url).toBe(true)
      expect(readFileSync(file).subarray(0, 4).toString('latin1'), url).toBe('wOF2')
    }
  })

  it('declares the three families with font-display: swap', () => {
    const faces = fontsCss.match(/@font-face\s*{[^}]*}/g) ?? []
    expect(faces).toHaveLength(4)
    for (const face of faces) expect(face).toMatch(/font-display:\s*swap/)
    for (const { name } of FAMILIES) {
      expect(fontsCss).toContain(`font-family: '${name}'`)
    }
  })

  it('ships an OFL license per family', () => {
    const files = readdirSync(fontsDir)
    for (const { slug } of FAMILIES) {
      const license = `OFL-${slug}.txt`
      expect(files, license).toContain(license)
      expect(readFileSync(join(fontsDir, license), 'utf8')).toContain('SIL Open Font License, Version 1.1')
    }
  })
})
