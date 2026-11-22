/** Minimal DOM doubles for the theme boot script and store (no jsdom in this project). */
export class FakeElement {
  attrs = new Map<string, string>()
  constructor(init: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(init)) this.attrs.set(k, v)
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value))
  }
  removeAttribute(name: string): void {
    this.attrs.delete(name)
  }
  hasAttribute(name: string): boolean {
    return this.attrs.has(name)
  }
}

export const LIGHT_THEME_COLOR = '#FBFAF7'
export const DARK_THEME_COLOR = '#12202E'

export function fakeDocument() {
  const documentElement = new FakeElement()
  const metas = [
    new FakeElement({ name: 'theme-color', content: LIGHT_THEME_COLOR, media: '(prefers-color-scheme: light)' }),
    new FakeElement({ name: 'theme-color', content: DARK_THEME_COLOR, media: '(prefers-color-scheme: dark)' }),
  ]
  const doc = {
    documentElement,
    querySelectorAll: (selector: string) => (selector === 'meta[name="theme-color"]' ? metas : []),
  }
  return { doc, documentElement, metas }
}

export function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    get length() {
      return map.size
    },
  }
}

export const throwingStorage = {
  getItem(): string | null {
    throw new Error('SecurityError')
  },
  setItem(): void {
    throw new Error('QuotaExceededError')
  },
  removeItem(): void {
    throw new Error('SecurityError')
  },
}
