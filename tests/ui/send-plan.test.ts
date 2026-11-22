import { describe, expect, it } from 'vitest'
import { planOutput, planSend, whatsappLink } from '../../src/ui/send-plan.ts'

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

describe('planOutput', () => {
  const noShare = {}
  it('phone with Web Share: share, print, save, send; share highlighted; send closed', () => {
    expect(planOutput({ ...phone, ...canShare }, file, { wide: false })).toEqual({
      options: ['share', 'print', 'save', 'send'],
      highlighted: 'share',
      sendOpen: false,
      saveLabel: 'phone',
    })
  })
  it('phone without Web Share: print, save, send; print highlighted; send open', () => {
    expect(planOutput({ ...phone, ...noShare }, file, { wide: false })).toEqual({
      options: ['print', 'save', 'send'],
      highlighted: 'print',
      sendOpen: true,
      saveLabel: 'phone',
    })
  })
  it('wide desktop with Web Share: share shows but print is highlighted; «Guardar PDF»', () => {
    expect(planOutput({ ...desktop, ...canShare }, file, { wide: true })).toEqual({
      options: ['share', 'print', 'save', 'send'],
      highlighted: 'print',
      sendOpen: false,
      saveLabel: 'pdf',
    })
  })
  it('a visible default action wins', () => {
    expect(planOutput({ ...phone, ...canShare }, file, { wide: false, defaultAction: 'save' }).highlighted).toBe('save')
    expect(planOutput(desktop, file, { wide: true, defaultAction: 'send' }).highlighted).toBe('send')
  })
  it('a hidden default action falls back to the normal rule', () => {
    expect(planOutput(phone, file, { wide: false, defaultAction: 'share' }).highlighted).toBe('print')
    expect(planOutput(desktop, file, { wide: true, defaultAction: 'share' }).highlighted).toBe('print')
  })
  it('without a file there is no share option', () => {
    const plan = planOutput({ ...phone, ...canShare }, null, { wide: false })
    expect(plan.options).toEqual(['print', 'save', 'send'])
    expect(plan.highlighted).toBe('print')
    expect(plan.sendOpen).toBe(true)
  })
  it('narrow window on a desktop browser keeps «Guardar PDF»; a wide phone keeps «Guardar en el teléfono»', () => {
    expect(planOutput(desktop, file, { wide: false }).saveLabel).toBe('pdf')
    expect(planOutput(phone, file, { wide: true }).saveLabel).toBe('phone')
  })
})
