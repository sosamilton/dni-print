import { parsePrefs, PREFS_KEY, serializePrefs, withTheme, type ThemeChoice } from './preferences.ts'

/** Theme store (CAP-6) for `useSyncExternalStore`: applies `data-theme` and `theme-color` and persists Claro/Oscuro. */
export interface ThemeStore {
  getSnapshot(): ThemeChoice
  subscribe(listener: () => void): () => void
  setChoice(choice: ThemeChoice): void
  /** Re-applies the current choice to the document (idempotent; `theme-boot.js` normally did it already). */
  init(): void
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function readRaw(getStorage: () => StorageLike | null): string | null {
  try {
    return getStorage()?.getItem(PREFS_KEY) ?? null
  } catch {
    return null
  }
}

/** Sets or clears `data-theme` and points both theme-color metas at the chosen scheme (originals kept in `data-content`). */
export function applyTheme(doc: Document, choice: ThemeChoice): void {
  const root = doc.documentElement
  const metas = [...doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
  if (choice === 'system') {
    root.removeAttribute('data-theme')
    for (const meta of metas) {
      const original = meta.getAttribute('data-content')
      if (original === null) continue
      meta.setAttribute('content', original)
      meta.removeAttribute('data-content')
    }
    return
  }
  root.setAttribute('data-theme', choice)
  const originalOf = (meta: HTMLMetaElement) => meta.getAttribute('data-content') ?? meta.getAttribute('content') ?? ''
  const source = metas.find((meta) => (meta.getAttribute('media') ?? '').includes(`prefers-color-scheme: ${choice}`))
  if (!source) return
  const color = originalOf(source)
  for (const meta of metas) {
    meta.setAttribute('data-content', originalOf(meta))
    meta.setAttribute('content', color)
  }
}

export function createThemeStore(doc: Document | null, getStorage: () => StorageLike | null): ThemeStore {
  let choice = parsePrefs(readRaw(getStorage)).theme
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => choice,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    init() {
      if (doc) applyTheme(doc, choice)
    },
    setChoice(next) {
      choice = next
      if (doc) applyTheme(doc, next)
      try {
        const storage = getStorage()
        if (storage) {
          const value = serializePrefs(withTheme(parsePrefs(storage.getItem(PREFS_KEY)), next))
          if (value === null) storage.removeItem(PREFS_KEY)
          else storage.setItem(PREFS_KEY, value)
        }
      } catch {
        // Private mode or quota: the theme still changes for this session.
      }
      listeners.forEach((listener) => listener())
    },
  }
}

export const themeStore = createThemeStore(typeof document === 'undefined' ? null : document, () =>
  typeof window === 'undefined' ? null : window.localStorage,
)
