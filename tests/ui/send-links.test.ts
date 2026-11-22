import { describe, expect, it } from 'vitest'
import { gmailUrl, mailtoUrl, showDesktopSend, validateEmail, whatsappWebUrl } from '../../src/ui/send-links.ts'

const file = new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' })
const subject = 'Cédula & trámite #1'
const body = 'Hola,\nte paso el PDF: ¿ok? 100% & más #2'

describe('links', () => {
  it('gmailUrl encodes accents, newlines, & and #', () => {
    const url = gmailUrl('a+b@x.com', subject, body)
    expect(url.startsWith('https://mail.google.com/mail/?view=cm&fs=1&to=a%2Bb%40x.com&su=')).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('su')).toBe(subject)
    expect(params.get('body')).toBe(body)
    expect(params.get('to')).toBe('a+b@x.com')
    expect(url).not.toMatch(/[ \n#](?!$)/)
  })

  it('mailtoUrl uses the same subject and text', () => {
    const url = mailtoUrl('', subject, body)
    expect(url).toBe(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  })

  it('whatsappWebUrl encodes the text', () => {
    const url = whatsappWebUrl('5491123456789', body)
    expect(url.startsWith('https://web.whatsapp.com/send?phone=5491123456789&text=')).toBe(true)
    expect(new URL(url).searchParams.get('text')).toBe(body)
  })
})

describe('validateEmail', () => {
  it('accepts empty (optional) and real addresses', () => {
    expect(validateEmail('  ')).toEqual({ ok: true, email: '' })
    expect(validateEmail(' imprenta@ejemplo.com.ar ')).toEqual({ ok: true, email: 'imprenta@ejemplo.com.ar' })
  })
  it.each(['sin-arroba', 'a@b', 'a b@c.com', '@c.com', 'a@b@c.com'])('rejects %j', (v) => {
    expect(validateEmail(v)).toEqual({ ok: false })
  })
})

describe('showDesktopSend', () => {
  it('shows when the browser cannot share files', () => {
    expect(showDesktopSend({}, file)).toBe(true)
    expect(showDesktopSend({ share: async () => {}, canShare: () => false }, file)).toBe(true)
  })
  it('hides when it can share files or there is no PDF', () => {
    expect(showDesktopSend({ share: async () => {}, canShare: () => true }, file)).toBe(false)
    expect(showDesktopSend({}, null)).toBe(false)
    expect(showDesktopSend({ share: async () => {}, canShare: () => { throw new Error('x') } }, file)).toBe(true)
  })
})
