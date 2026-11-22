import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createMediaQueryStore,
  isEffectiveDark,
  moreItems,
  sheetGroups,
  toggledTheme,
  WIDE_MEDIA_QUERY,
  wrapFocus,
} from '../../src/ui/menu-model.ts'

describe('desktop theme button', () => {
  it.each([
    ['system', false, false, 'dark'],
    ['system', true, true, 'light'],
    ['dark', false, true, 'light'],
    ['dark', true, true, 'light'],
    ['light', false, false, 'dark'],
    ['light', true, false, 'dark'],
  ] as const)('%s with system dark=%s: pressed=%s, toggles to %s', (choice, systemDark, pressed, next) => {
    expect(isEffectiveDark(choice, systemDark)).toBe(pressed)
    expect(toggledTheme(choice, systemDark)).toBe(next)
  })
})

describe('wrapFocus', () => {
  it('moves forward and wraps from the last to the first', () => {
    expect(wrapFocus(0, 3, false)).toBe(1)
    expect(wrapFocus(2, 3, false)).toBe(0)
  })

  it('moves backwards and wraps from the first to the last', () => {
    expect(wrapFocus(2, 3, true)).toBe(1)
    expect(wrapFocus(0, 3, true)).toBe(2)
  })

  it('enters at an end when focus is outside the controls', () => {
    expect(wrapFocus(-1, 3, false)).toBe(0)
    expect(wrapFocus(-1, 3, true)).toBe(2)
  })

  it('stays on a single control and reports none when empty', () => {
    expect(wrapFocus(0, 1, false)).toBe(0)
    expect(wrapFocus(0, 1, true)).toBe(0)
    expect(wrapFocus(-1, 0, false)).toBe(-1)
  })
})

describe('createMediaQueryStore', () => {
  it('is false and subscribable without matchMedia', () => {
    const store = createMediaQueryStore(WIDE_MEDIA_QUERY, null)
    expect(store.getSnapshot()).toBe(false)
    expect(() => store.subscribe(() => {})()).not.toThrow()
  })

  it('is false when matchMedia throws', () => {
    const store = createMediaQueryStore(WIDE_MEDIA_QUERY, () => {
      throw new Error('nope')
    })
    expect(store.getSnapshot()).toBe(false)
  })

  it('follows a changing media query and stops after unsubscribing', () => {
    const target = new EventTarget()
    const list = Object.assign(target, { matches: false, media: WIDE_MEDIA_QUERY }) as unknown as MediaQueryList
    const mm = vi.fn(() => list)
    const store = createMediaQueryStore(WIDE_MEDIA_QUERY, mm)
    expect(mm).toHaveBeenCalledWith(WIDE_MEDIA_QUERY)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    ;(list as { matches: boolean }).matches = true
    target.dispatchEvent(new Event('change'))
    expect(store.getSnapshot()).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
    target.dispatchEvent(new Event('change'))
    expect(listener).toHaveBeenCalledOnce()
  })
})

describe('breakpoint parity', () => {
  it('tokens.css uses the same 900px media query as the menu', () => {
    const css = readFileSync(join(import.meta.dirname, '..', '..', 'src', 'ui', 'styles', 'tokens.css'), 'utf8')
    expect(WIDE_MEDIA_QUERY).toBe('(min-width: 900px)')
    expect(css).toContain(`@media ${WIDE_MEDIA_QUERY} {`)
  })
})

describe('menu items', () => {
  const all = { installable: true, canRestart: true, hasSourceCode: true }

  it('sheet: four groups in contract order, never Preferencias', () => {
    expect(sheetGroups(all)).toEqual([['theme'], ['share', 'install'], ['privacy', 'sourceCode'], ['restart']])
  })

  it('desktop ⋯: Instalar, Código fuente and Empezar de nuevo last', () => {
    expect(moreItems(all)).toEqual(['install', 'sourceCode', 'restart'])
  })

  it('without onRestart there is no Empezar de nuevo group or item', () => {
    const a = { ...all, canRestart: false }
    expect(sheetGroups(a)).toEqual([['theme'], ['share', 'install'], ['privacy', 'sourceCode']])
    expect(moreItems(a)).toEqual(['install', 'sourceCode'])
  })

  it('when not installable there is no Instalar la app', () => {
    const a = { ...all, installable: false }
    expect(sheetGroups(a)[1]).toEqual(['share'])
    expect(moreItems(a)).toEqual(['sourceCode', 'restart'])
  })

  it('without a repo URL Código fuente is the disabled variant', () => {
    const a = { ...all, hasSourceCode: false }
    expect(sheetGroups(a)[2]).toEqual(['privacy', 'sourceCodeUnavailable'])
    expect(moreItems(a)).toContain('sourceCodeUnavailable')
    expect(moreItems(a)).not.toContain('sourceCode')
  })
})
