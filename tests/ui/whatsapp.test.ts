import { describe, expect, it } from 'vitest'
import { strings } from '../../src/ui/strings.es.ts'
import { normalizeArPhone, whatsappUrl } from '../../src/ui/whatsapp.ts'

describe('normalizeArPhone', () => {
  it.each([
    ['11 2345 6789', '5491123456789'],
    ['011 15 2345-6789', '5491123456789'],
    ['(0351) 15 123-4567', '5493511234567'],
    ['02944 15 41-2345', '5492944412345'],
    ['+54 9 11 2345 6789', '5491123456789'],
    ['+54 11 2345 6789', '5491123456789'],
    ['5491123456789', '5491123456789'],
    ['+54 011 15 2345 6789', '5491123456789'],
    ['11.2345.6789', '5491123456789'],
    ['\u202A+54 9 11 2345\u20116789\u202C', '5491123456789'],
    ['11/2345/6789', '5491123456789'],
    ['\uFEFF11\u20142345\u22126789\u200B', '5491123456789'],
  ])('%s → %s', (input, digits) => {
    expect(normalizeArPhone(input)).toEqual({ ok: true, digits })
  })

  it.each(['', '  - ', '()', ' . '])('%j is empty', (input) => {
    expect(normalizeArPhone(input)).toEqual({ ok: false, reason: 'empty' })
  })

  it.each([
    '+1 555 123 4567',
    '11 2345 678',
    '11 2345 67890',
    '15 2345 6789',
    '41 2345 6789',
    '11-2345-abcd',
    '11+23456789',
    '+',
    '++54 11 2345 6789',
    '+011 2345 6789',
  ])('%j is invalid', (input) => {
    expect(normalizeArPhone(input)).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('whatsappUrl', () => {
  it('builds the wa.me link with the encoded message', () => {
    expect(whatsappUrl('5491123456789', strings.output.whatsapp.message)).toBe(
      'https://wa.me/5491123456789?text=Hola%2C%20te%20paso%20un%20documento%20para%20imprimir%20a%20tama%C3%B1o%20real.',
    )
    expect(whatsappUrl('5491123456789', 'a&b=c?')).toBe('https://wa.me/5491123456789?text=a%26b%3Dc%3F')
  })
})
