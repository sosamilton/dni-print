import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { blockAfter, splitTokens } from './tokens-css.ts'

const repoRoot = join(import.meta.dirname, '..', '..')
const stylesDir = join(repoRoot, 'src', 'ui', 'styles')
const tokensPath = join(stylesDir, 'tokens.css')
const fontsPath = join(stylesDir, 'fonts.css')

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function readCss(path: string): string {
  return stripComments(readFileSync(path, 'utf8'))
}

function declarations(css: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1], match[2].trim())
  }
  return map
}

const LIGHT_COLORS: Record<string, string> = {
  'surface-base': '#FBFAF7',
  'surface-raised': '#FFFFFF',
  'ink-primary': '#1D2730',
  'ink-secondary': '#6B7782',
  accent: '#2563A8',
  'accent-soft': '#E6EEF7',
  'border-hairline': '#E2E0DA',
  placeholder: '#ECEAE4',
  warning: '#9A5B00',
  danger: '#B3261E',
}

const DARK_COLORS: Record<string, string> = {
  'surface-base': '#12181D',
  'surface-raised': '#1B232A',
  'ink-primary': '#E8EDF0',
  'ink-secondary': '#9AA7B1',
  accent: '#7DB0E8',
  'accent-soft': '#1C2E42',
  'border-hairline': '#2B353D',
  placeholder: '#242D34',
}

const TYPOGRAPHY: Record<string, { family: string; size: string; weight: string; lineHeight: string }> = {
  title: { family: 'Familjen Grotesk', size: '24px', weight: '700', lineHeight: '1.15' },
  body: { family: 'Atkinson Hyperlegible', size: '17px', weight: '400', lineHeight: '1.5' },
  label: { family: 'Atkinson Hyperlegible', size: '15px', weight: '700', lineHeight: '1.3' },
  meta: { family: 'JetBrains Mono', size: '12px', weight: '400', lineHeight: '1.4' },
  button: { family: 'Atkinson Hyperlegible', size: '17px', weight: '700', lineHeight: '1.2' },
}

const OTHER_TOKENS: Record<string, string> = {
  '--rounded-sm': '9px',
  '--rounded-md': '12px',
  '--rounded-lg': '14px',
  '--rounded-xl': '16px',
  '--rounded-full': '9999px',
  '--spacing-1': '4px',
  '--spacing-2': '8px',
  '--spacing-3': '12px',
  '--spacing-4': '16px',
  '--spacing-5': '20px',
  '--spacing-6': '24px',
  '--spacing-7': '32px',
  '--column-max': '480px',
  '--margin-mobile': '20px',
  '--button-padding': '15px',
  '--button-min-height': '52px',
  '--progress-height': '5px',
  '--progress-rounded': '3px',
}

function cssFilesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) => join(entry.parentPath, entry.name))
}

const rel = (path: string) => relative(repoRoot, path).split(sep).join('/')

describe('design tokens', () => {
  const css = readCss(tokensPath)
  const { light, systemDark, explicitDark } = splitTokens(css)
  const lightTokens = declarations(light)

  it('declares color-scheme light dark', () => {
    expect(light).toMatch(/color-scheme:\s*light dark;/)
  })

  it('declares every light color as in DESIGN.md', () => {
    for (const [name, value] of Object.entries(LIGHT_COLORS)) {
      expect(lightTokens.get(`--color-${name}`)?.toUpperCase(), name).toBe(value)
    }
  })

  it.each([
    ['prefers-color-scheme: dark without data-theme=light', () => systemDark],
    ['data-theme=dark', () => explicitDark],
  ])('redefines the -dark colors for %s', (_, block) => {
    const darkTokens = declarations(block())
    for (const [name, value] of Object.entries(DARK_COLORS)) {
      expect(darkTokens.get(`--color-${name}`)?.toUpperCase(), name).toBe(value)
    }
    expect(block()).toMatch(/color-scheme:\s*dark;/)
  })

  it('keeps both dark blocks identical', () => {
    expect(declarations(systemDark)).toEqual(declarations(explicitDark))
    expect(systemDark.replace(/\s+/g, ' ').trim()).toBe(explicitDark.replace(/\s+/g, ' ').trim())
  })

  it('forces the light color-scheme with data-theme=light', () => {
    expect(blockAfter(css, ":root[data-theme='light']")).toMatch(/color-scheme:\s*light;/)
  })

  it('declares every typography role as in DESIGN.md', () => {
    for (const [role, t] of Object.entries(TYPOGRAPHY)) {
      expect(lightTokens.get(`--font-${role}-family`), role).toMatch(new RegExp(`^'${t.family}'`))
      expect(lightTokens.get(`--font-${role}-size`), role).toBe(t.size)
      expect(lightTokens.get(`--font-${role}-weight`), role).toBe(t.weight)
      expect(lightTokens.get(`--font-${role}-line-height`), role).toBe(t.lineHeight)
    }
  })

  it('declares rounded, spacing and component tokens as in DESIGN.md', () => {
    for (const [name, value] of Object.entries(OTHER_TOKENS)) {
      expect(lightTokens.get(name), name).toBe(value)
    }
    expect(lightTokens.has('--hairline')).toBe(true)
  })
})

describe('stylesheets outside tokens.css', () => {
  const others = cssFilesUnder(join(repoRoot, 'src')).filter((path) => path !== tokensPath)

  it('exist', () => {
    expect(others.map(rel)).toEqual(expect.arrayContaining(['src/index.css', 'src/ui/wizard-layout.css']))
  })

  it('use no raw colors', () => {
    for (const path of others) {
      const css = readCss(path)
      expect(css, rel(path)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/)
    }
  })

  it('use no px/rem/em literals other than 0', () => {
    for (const path of others) {
      const literals = readCss(path).match(/(?<![\w-])\d*\.?\d+(?:px|rem|em)\b/g) ?? []
      expect(literals.filter((l) => parseFloat(l) !== 0), rel(path)).toEqual([])
    }
  })

  it('set font-family only through var() (except @font-face in fonts.css)', () => {
    for (const path of others) {
      if (path === fontsPath) continue
      for (const match of readCss(path).matchAll(/font-family\s*:\s*([^;}]+)/g)) {
        expect(match[1], rel(path)).toMatch(/^\s*var\(/)
      }
    }
  })
})

describe('all stylesheets', () => {
  it('reference no http(s) URLs', () => {
    for (const path of cssFilesUnder(join(repoRoot, 'src'))) {
      expect(readFileSync(path, 'utf8'), rel(path)).not.toMatch(/http/i)
    }
  })
})
