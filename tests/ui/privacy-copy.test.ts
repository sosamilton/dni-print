import { describe, expect, it } from 'vitest'
import { strings } from '../../src/ui/strings.es.ts'

describe('privacy menu copy', () => {
  it('names the menu items exactly', () => {
    expect(strings.menu.privacy).toBe('Cómo funciona y privacidad')
    expect(strings.menu.sourceCode).toBe('Código fuente')
  })

  it('explains device-only processing, nothing stored or sent, and the AGPL-3.0 license', () => {
    const text = strings.privacyDialog.paragraphs.join(' ')
    expect(strings.privacyDialog.title).toBe(strings.menu.privacy)
    expect(text).toMatch(/tu dispositivo/)
    expect(text).toMatch(/no se guardan ni se envían/)
    expect(text).toMatch(/[Nn]o hay cuentas ni servidores/)
    expect(text).toMatch(/se borran/)
    expect(text).toContain('AGPL-3.0')
  })
})
