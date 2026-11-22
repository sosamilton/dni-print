import { describe, expect, it } from 'vitest'
import { planSend, whatsappLink } from '../../src/ui/send-plan.ts'

const file = new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' })
const desktop = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120' }
const phone = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel) Mobile Safari' }
const canShare = { share: async () => {}, canShare: () => true }

describe('planSend', () => {
  it('desktop without Web Share: no share row, others open, WhatsApp Web, mail program', () => {
    expect(planSend(desktop, file)).toEqual({ share: false, whatsapp: 'web', mailProgram: true, dragHint: true, othersOpen: true })
  })
  it('phone with Web Share: share row, others closed, wa.me', () => {
    expect(planSend({ ...phone, ...canShare }, file)).toEqual({ share: true, whatsapp: 'wa.me', mailProgram: false, dragHint: false, othersOpen: false })
  })
  it('compatible desktop gets the share row too', () => {
    const plan = planSend({ ...desktop, ...canShare }, file)
    expect(plan.share).toBe(true)
    expect(plan.whatsapp).toBe('web')
  })
  it('no file or throwing canShare: no share row', () => {
    expect(planSend({ ...phone, ...canShare }, null).share).toBe(false)
    expect(planSend({ ...phone, share: async () => {}, canShare: () => { throw new Error('x') } }, file).share).toBe(false)
  })
})

describe('whatsappLink', () => {
  it('picks the destination from the plan', () => {
    expect(whatsappLink(planSend(desktop, file), '5491123456789', 'a b')).toBe('https://web.whatsapp.com/send?phone=5491123456789&text=a%20b')
    expect(whatsappLink(planSend(phone, file), '5491123456789', 'a b')).toBe('https://wa.me/5491123456789?text=a%20b')
  })
})
