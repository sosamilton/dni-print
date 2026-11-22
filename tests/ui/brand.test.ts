import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..', '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')

describe('marca en la interfaz', () => {
  const tokens = read('src', 'ui', 'styles', 'tokens.css')
  const at = tokens.indexOf('@media (prefers-color-scheme: dark)')
  const light = tokens.slice(0, at)
  const dark = tokens.slice(at)

  it('declara celeste, sol y el color de las esquinas como en identity.md', () => {
    expect(light).toMatch(/--color-celeste:\s*#74ACDF;/i)
    expect(light).toMatch(/--color-sol:\s*#F6B40E;/i)
    expect(light).toMatch(/--color-brand-corners:\s*#2563A8;/i)
    expect(dark).toMatch(/--color-brand-corners:\s*#74ACDF;/i)
  })

  it('el componente usa la geometría de identity.md', () => {
    const tsx = read('src', 'ui', 'brand.tsx')
    for (const d of ['M6 18V9a3 3 0 013-3h9', 'M46 6h9a3 3 0 013 3v9', 'M58 46v9a3 3 0 01-3 3h-9', 'M18 58H9a3 3 0 01-3-3v-9']) {
      expect(tsx).toContain(`d="${d}"`)
    }
    expect(tsx).toContain('viewBox="0 0 64 64"')
    expect(tsx).toContain('aria-hidden="true"')
  })

  it('el encabezado del asistente muestra la marca', () => {
    expect(read('src', 'ui', 'wizard-layout.tsx')).toContain('<Brand />')
  })
})
