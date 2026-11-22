/**
 * Local preferences (CAP-6, story 9-6 extends it): one versioned JSON value in
 * localStorage under `PREFS_KEY`. Pure: no storage access here. Never holds
 * images, PDFs or document data. `public/theme-boot.js` duplicates the key and
 * the theme validation (it cannot import TS); `tests/ui/theme-boot.test.ts`
 * keeps both in sync.
 */
export const PREFS_KEY = 'dni-print:prefs'
export const PREFS_VERSION = 1

export const THEME_CHOICES = ['system', 'light', 'dark'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]

export interface Prefs {
  readonly theme: ThemeChoice
}

export const DEFAULT_PREFS: Prefs = Object.freeze({ theme: 'system' })

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
  const theme = (data as { theme?: unknown }).theme
  return isStoredTheme(theme) ? { ...DEFAULT_PREFS, theme } : DEFAULT_PREFS
}

/** The value to store, or null when every preference is the default (the key must then be removed). */
export function serializePrefs(prefs: Prefs): string | null {
  if (!isStoredTheme(prefs.theme)) return null
  return JSON.stringify({ v: PREFS_VERSION, theme: prefs.theme })
}

export function withTheme(prefs: Prefs, theme: ThemeChoice): Prefs {
  return { ...prefs, theme }
}
