// Pure WhatsApp helpers: Argentine phone normalization and the wa.me link. Never throw.

export type NormalizedPhone = { ok: true; digits: string } | { ok: false; reason: 'empty' | 'invalid' }

const SEPARATORS = /[\s\-.()/\u2010-\u2015\u2212\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g
const NATIONAL = /^(11|[23]\d)\d{8}$/

/**
 * Normalizes an Argentine mobile number to WhatsApp's international form (`549` + 10-digit
 * national number). Accepts local (`011 15 …`) and international (`+54 9 …`) spellings.
 */
export function normalizeArPhone(input: string): NormalizedPhone {
  const compact = String(input).replace(SEPARATORS, '')
  if (compact === '') return { ok: false, reason: 'empty' }
  const hasPlus = compact.startsWith('+')
  let digits = hasPlus ? compact.slice(1) : compact
  if (!/^\d+$/.test(digits)) return { ok: false, reason: 'invalid' }

  if (hasPlus || digits.startsWith('54')) {
    if (!digits.startsWith('54')) return { ok: false, reason: 'invalid' }
    digits = digits.slice(2)
    if (digits.startsWith('9')) digits = digits.slice(1)
    if (digits.startsWith('0')) digits = digits.slice(1)
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  if (digits.length === 12) {
    for (const at of [2, 3, 4]) {
      if (digits.slice(at, at + 2) === '15') {
        digits = digits.slice(0, at) + digits.slice(at + 2)
        break
      }
    }
  }

  if (!NATIONAL.test(digits)) return { ok: false, reason: 'invalid' }
  return { ok: true, digits: `549${digits}` }
}

export function whatsappUrl(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
