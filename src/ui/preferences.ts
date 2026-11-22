/**
 * Local preferences (CAP-6, story 9-6 extends it): one versioned JSON value in
 * localStorage under `PREFS_KEY`. Pure: no storage access here. Never holds
 * images, PDFs or document data. `public/theme-boot.js` duplicates the key and
 * the theme validation (it cannot import TS); `tests/ui/theme-boot.test.ts`
 * keeps both in sync.
 */
import { validateEmail } from './send-links.ts'
import { normalizeArPhone } from './whatsapp.ts'

export const PREFS_KEY = 'dni-print:prefs'
export const PREFS_VERSION = 1

export const THEME_CHOICES = ['system', 'light', 'dark'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]

export interface Prefs {
  readonly theme: ThemeChoice
  /** Prefilled WhatsApp number (valid Argentine number) or ''. */
  readonly whatsapp: string
  /** Prefilled recipient mail (valid) or ''. */
  readonly email: string
}

export const DEFAULT_PREFS: Prefs = Object.freeze({ theme: 'system', whatsapp: '', email: '' })

const isStoredTheme = (value: unknown): value is 'light' | 'dark' => value === 'light' || value === 'dark'

/** Reads a stored value; anything broken, of another version or unknown falls back to the defaults. */
export function parsePrefs(raw: string | null | undefined): Prefs {
  if (typeof raw !== 'string' || raw === '') return DEFAULT_PREFS
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return DEFAULT_PREFS
  }
  if (typeof data !== 'object' || data === null || (data as { v?: unknown }).v !== PREFS_VERSION) return DEFAULT_PREFS
  const { theme, whatsapp, email } = data as { theme?: unknown; whatsapp?: unknown; email?: unknown }
  return {
    theme: isStoredTheme(theme) ? theme : DEFAULT_PREFS.theme,
    whatsapp: typeof whatsapp === 'string' && normalizeArPhone(whatsapp).ok ? whatsapp.trim() : '',
    email: typeof email === 'string' && validateEmail(email).ok ? email.trim() : '',
  }
}

/** The value to store, or null when every preference is the default (the key must then be removed). */
export function serializePrefs(prefs: Prefs): string | null {
  const phone = normalizeArPhone(prefs.whatsapp).ok ? prefs.whatsapp.trim() : ''
  const email = validateEmail(prefs.email).ok ? prefs.email.trim() : ''
  const theme = isStoredTheme(prefs.theme) ? prefs.theme : undefined
  if (!theme && !phone && !email) return null
  return JSON.stringify({ v: PREFS_VERSION, ...(theme && { theme }), ...(phone && { whatsapp: phone }), ...(email && { email }) })
}

export function withTheme(prefs: Prefs, theme: ThemeChoice): Prefs {
  return { ...prefs, theme }
}
