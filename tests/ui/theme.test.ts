import { describe, expect, it, vi } from 'vitest'
import { PREFS_KEY } from '../../src/ui/preferences.ts'
import { createThemeStore } from '../../src/ui/theme.ts'
import { DARK_THEME_COLOR, fakeDocument, fakeStorage, LIGHT_THEME_COLOR, throwingStorage } from './theme-fake-dom.ts'

const asDoc = (doc: unknown) => doc as Document

describe('theme store', () => {
  it('starts from the stored choice', () => {
    const { doc } = fakeDocument()
    expect(createThemeStore(asDoc(doc), () => fakeStorage({ [PREFS_KEY]: '{"v":1,"theme":"light"}' })).getSnapshot()).toBe('light')
    expect(createThemeStore(asDoc(doc), () => fakeStorage({ [PREFS_KEY]: '{oops' })).getSnapshot()).toBe('system')
    expect(createThemeStore(asDoc(doc), () => throwingStorage).getSnapshot()).toBe('system')
  })

  it('Oscuro sets data-theme, theme-color and saves; Sistema clears everything', () => {
    const { doc, documentElement, metas } = fakeDocument()
    const storage = fakeStorage()
    const store = createThemeStore(asDoc(doc), () => storage)
    const listener = vi.fn()
    store.subscribe(listener)

    store.setChoice('dark')
    expect(store.getSnapshot()).toBe('dark')
    expect(documentElement.getAttribute('data-theme')).toBe('dark')
    expect(metas.map((m) => m.getAttribute('content'))).toEqual([DARK_THEME_COLOR, DARK_THEME_COLOR])
    expect(storage.map.get(PREFS_KEY)).toBe('{"v":1,"theme":"dark"}')

    store.setChoice('light')
    expect(metas.map((m) => m.getAttribute('content'))).toEqual([LIGHT_THEME_COLOR, LIGHT_THEME_COLOR])
    expect(storage.map.get(PREFS_KEY)).toBe('{"v":1,"theme":"light"}')

    store.setChoice('system')
    expect(documentElement.getAttribute('data-theme')).toBeNull()
    expect(metas.map((m) => m.getAttribute('content'))).toEqual([LIGHT_THEME_COLOR, DARK_THEME_COLOR])
    expect(metas.every((m) => !m.hasAttribute('data-content'))).toBe(true)
    expect(storage.length).toBe(0)
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('still changes the theme for the session when storage throws', () => {
    const { doc, documentElement } = fakeDocument()
    const store = createThemeStore(asDoc(doc), () => throwingStorage)
    expect(() => store.setChoice('dark')).not.toThrow()
    expect(store.getSnapshot()).toBe('dark')
    expect(documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('init re-applies the stored choice', () => {
    const { doc, documentElement } = fakeDocument()
    createThemeStore(asDoc(doc), () => fakeStorage({ [PREFS_KEY]: '{"v":1,"theme":"dark"}' })).init()
    expect(documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('reload re-reads the stored choice, re-applies it and notifies', () => {
    const { doc, documentElement } = fakeDocument()
    const storage = fakeStorage({ [PREFS_KEY]: '{"v":1,"theme":"dark"}' })
    const store = createThemeStore(asDoc(doc), () => storage)
    const listener = vi.fn()
    store.subscribe(listener)
    storage.map.set(PREFS_KEY, '{"v":1,"theme":"light"}')
    store.reload()
    expect(store.getSnapshot()).toBe('light')
    expect(documentElement.getAttribute('data-theme')).toBe('light')
    storage.map.delete(PREFS_KEY)
    store.reload()
    expect(store.getSnapshot()).toBe('system')
    expect(documentElement.getAttribute('data-theme')).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
