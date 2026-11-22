import type { ThemeChoice } from './preferences.ts'

/**
 * Pure helpers for the header menu (story 9-2). `WIDE_MEDIA_QUERY` duplicates the
 * 900px breakpoint of `styles/tokens.css` (media queries cannot read var());
 * `tests/ui/menu-model.test.ts` keeps both in sync.
 */
export const WIDE_MEDIA_QUERY = '(min-width: 900px)'
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

/** True when the page is showing dark colors for this choice and system appearance. */
export function isEffectiveDark(choice: ThemeChoice, systemDark: boolean): boolean {
  return choice === 'dark' || (choice === 'system' && systemDark)
}

/** Desktop theme button: always lands on the explicit opposite of what is on screen. */
export function toggledTheme(choice: ThemeChoice, systemDark: boolean): 'light' | 'dark' {
  return isEffectiveDark(choice, systemDark) ? 'light' : 'dark'
}

/**
 * Index to focus after Tab (or Shift+Tab when `backwards`) from `index` among `count`
 * focusable controls, wrapping at both ends. `index` -1 means focus is on none of them.
 */
export function wrapFocus(index: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1
  if (backwards) return index <= 0 || index >= count ? count - 1 : index - 1
  return index < 0 || index >= count - 1 ? 0 : index + 1
}

export interface MediaQueryStore {
  getSnapshot(): boolean
  subscribe(listener: () => void): () => void
}

type MatchMedia = (query: string) => MediaQueryList

/** A `useSyncExternalStore` source for a media query; always `false` without `matchMedia`. */
export function createMediaQueryStore(query: string, mm?: MatchMedia | null): MediaQueryStore {
  const match = mm === undefined ? (typeof matchMedia === 'function' ? (q: string) => matchMedia(q) : null) : mm
  let list: MediaQueryList | null = null
  try {
    list = match ? match(query) : null
  } catch {
    list = null
  }
  return {
    getSnapshot: () => list?.matches ?? false,
    subscribe(listener) {
      if (!list) return () => {}
      if (typeof list.addEventListener === 'function') {
        list.addEventListener('change', listener)
        return () => list?.removeEventListener('change', listener)
      }
      list.addListener(listener)
      return () => list?.removeListener(listener)
    },
  }
}

/** What the menu can offer right now. */
export interface MenuAvailability {
  installable: boolean
  canRestart: boolean
  hasSourceCode: boolean
}

export type MenuItemId = 'theme' | 'share' | 'install' | 'preferences' | 'privacy' | 'sourceCode' | 'sourceCodeUnavailable' | 'restart'

function sourceCodeId(a: MenuAvailability): MenuItemId {
  return a.hasSourceCode ? 'sourceCode' : 'sourceCodeUnavailable'
}

/**
 * Bottom sheet (< 900px), in contract order: (1) Tema; (2) Compartir, Instalar, Preferencias; (3) Cómo funciona, Código fuente;
 * (4) Empezar de nuevo. Empty groups are dropped.
 */
export function sheetGroups(a: MenuAvailability): MenuItemId[][] {
  const groups: MenuItemId[][] = [
    ['theme'],
    a.installable ? ['share', 'install', 'preferences'] : ['share', 'preferences'],
    ['privacy', sourceCodeId(a)],
    a.canRestart ? ['restart'] : [],
  ]
  return groups.filter((group) => group.length > 0)
}

/** Desktop ⋯ list: Preferencias, Instalar (if offered), Código fuente and, last and set apart, Empezar de nuevo. */
export function moreItems(a: MenuAvailability): MenuItemId[] {
  return ['preferences' as const, ...(a.installable ? ['install' as const] : []), sourceCodeId(a), ...(a.canRestart ? ['restart' as const] : [])]
}
