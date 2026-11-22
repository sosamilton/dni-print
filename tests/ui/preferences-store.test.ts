import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFS, PREFS_KEY } from '../../src/ui/preferences.ts'
import { clearAllPrefs, PREFS_DB_NAME, readPrefs, savePrefs } from '../../src/ui/preferences-store.ts'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('preferences store', () => {
  it('saves, reads and removes the key when everything is default', () => {
    const ls = fakeStorage()
    vi.stubGlobal('localStorage', ls)
    savePrefs({ ...DEFAULT_PREFS, copies: 1, watermark: 'COPIA' })
    expect(readPrefs()).toEqual({ ...DEFAULT_PREFS, copies: 1, watermark: 'COPIA' })
    savePrefs(DEFAULT_PREFS)
    expect(ls.data.has(PREFS_KEY)).toBe(false)
  })

  it('does not throw without storage', async () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('x')
      },
      setItem() {
        throw new Error('x')
      },
      removeItem() {
        throw new Error('x')
      },
    })
    vi.stubGlobal('indexedDB', undefined)
    expect(readPrefs()).toEqual(DEFAULT_PREFS)
    expect(() => savePrefs({ ...DEFAULT_PREFS, copies: 1 })).not.toThrow()
    await expect(clearAllPrefs()).resolves.toBeUndefined()
  })

  it('clears the key and deletes every database', async () => {
    const ls = fakeStorage({ [PREFS_KEY]: '{"v":1,"copies":1}' })
    vi.stubGlobal('localStorage', ls)
    const deleted: string[] = []
    vi.stubGlobal('indexedDB', {
      databases: async () => [{ name: 'otra' }],
      deleteDatabase: (name: string) => {
        deleted.push(name)
        const req: { onsuccess?: () => void } = {}
        queueMicrotask(() => req.onsuccess?.())
        return req
      },
    })
    await clearAllPrefs()
    expect(ls.data.size).toBe(0)
    expect(deleted.sort()).toEqual(['otra', PREFS_DB_NAME].sort())
  })
})
