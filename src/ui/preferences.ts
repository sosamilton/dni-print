/**
 * Local preferences (CAP-6, story 9-6 extends it): one versioned JSON value in
 * localStorage under `PREFS_KEY`. Pure: no storage access here. Never holds
 * images, PDFs or document data. `public/theme-boot.js` duplicates the key and
 * the theme validation (it cannot import TS); `tests/ui/theme-boot.test.ts`
 * keeps both in sync.
 */
import { FACE_FILTERS, MAX_WATERMARK_CHARS } from '../core/index.ts'
import type { FaceFilter } from '../core/index.ts'
import { DEFAULT_MARGIN_MM, MAX_MARGIN_MM, MIN_MARGIN_MM } from './print-step-model.ts'
import { validateEmail } from './send-links.ts'
import { normalizeArPhone } from './whatsapp.ts'

export const PREFS_KEY = 'dni-print:prefs'
export const PREFS_VERSION = 1

export const THEME_CHOICES = ['system', 'light', 'dark'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]

export const DEFAULT_ACTIONS = ['share', 'print', 'save', 'send'] as const
/** '' = no default action. */
export type DefaultAction = '' | (typeof DEFAULT_ACTIONS)[number]

export interface Prefs {
  readonly theme: ThemeChoice
  /** Prefilled WhatsApp number (valid Argentine number) or ''. */
  readonly whatsapp: string
  /** Prefilled recipient mail (valid) or ''. */
  readonly email: string
  /** Output option highlighted by default ('' = none). */
  readonly defaultAction: DefaultAction
  readonly copies: 1 | 2
  readonly filter: FaceFilter
  readonly marginMm: number
  /** Watermark text ('' = off); on whenever there is text. */
  readonly watermark: string
}

export const DEFAULT_PREFS: Prefs = Object.freeze({
  theme: 'system',
  whatsapp: '',
  email: '',
  defaultAction: '',
  copies: 2,
  filter: 'color',
  marginMm: DEFAULT_MARGIN_MM,
  watermark: '',
})

const validAction = (v: unknown): DefaultAction => (DEFAULT_ACTIONS as readonly unknown[]).includes(v) ? (v as DefaultAction) : ''
const validCopies = (v: unknown): 1 | 2 => (v === 1 || v === 2 ? v : DEFAULT_PREFS.copies)
const validFilter = (v: unknown): FaceFilter => (FACE_FILTERS as readonly unknown[]).includes(v) ? (v as FaceFilter) : DEFAULT_PREFS.filter
const validMargin = (v: unknown): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= MIN_MARGIN_MM && v <= MAX_MARGIN_MM ? v : DEFAULT_MARGIN_MM
const validWatermark = (v: unknown): string => {
  if (typeof v !== 'string') return ''
  const text = v.trim()
  return Array.from(text).length <= MAX_WATERMARK_CHARS ? text : ''
}

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
  const { theme, whatsapp, email, defaultAction, copies, filter, marginMm, watermark } = data as Record<string, unknown>
  return {
    defaultAction: validAction(defaultAction),
    copies: validCopies(copies),
    filter: validFilter(filter),
    marginMm: validMargin(marginMm),
    watermark: validWatermark(watermark),
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
  const defaultAction = validAction(prefs.defaultAction)
  const copies = validCopies(prefs.copies)
  const filter = validFilter(prefs.filter)
  const marginMm = validMargin(prefs.marginMm)
  const watermark = validWatermark(prefs.watermark)
  const body = {
    ...(theme && { theme }),
    ...(phone && { whatsapp: phone }),
    ...(email && { email }),
    ...(defaultAction && { defaultAction }),
    ...(copies !== DEFAULT_PREFS.copies && { copies }),
    ...(filter !== DEFAULT_PREFS.filter && { filter }),
    ...(marginMm !== DEFAULT_MARGIN_MM && { marginMm }),
    ...(watermark && { watermark }),
  }
  if (Object.keys(body).length === 0) return null
  return JSON.stringify({ v: PREFS_VERSION, ...body })
}

export function withTheme(prefs: Prefs, theme: ThemeChoice): Prefs {
  return { ...prefs, theme }
}
