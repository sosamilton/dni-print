import { describe, expect, it, vi } from 'vitest'
import { planPrint, printPdf } from '../../src/ui/print-pdf.ts'
import type { PrintEnv, PrintNavigator } from '../../src/ui/print-pdf.ts'

const file = new File([new Uint8Array([37, 80, 68, 70])], 'x.pdf', { type: 'application/pdf' })
const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'

describe('planPrint', () => {
  it('picks the strategy per platform', () => {
    expect(planPrint({ userAgent: CHROME })).toBe('iframe')
    expect(planPrint({ userAgent: SAFARI_MAC, maxTouchPoints: 0 })).toBe('tab')
    expect(planPrint({ userAgent: IPHONE })).toBe('share')
    expect(planPrint({ userAgent: ANDROID })).toBe('share')
    expect(planPrint({ userAgent: SAFARI_MAC, maxTouchPoints: 5 })).toBe('share')
  })
})

class FakeFrame {
  static all: FakeFrame[] = []
  attrs: Record<string, string> = {}
  style = { cssText: '' }
  tabIndex = 0
  src = ''
  contentWindow: unknown = null
  removed = false
  private listeners: Record<string, () => void> = {}
  setAttribute(k: string, v: string) { this.attrs[k] = v }
  addEventListener(type: string, fn: () => void) { this.listeners[type] = fn }
  fire(type: string) { this.listeners[type]?.() }
  remove() { this.removed = true }
}
const fakeDoc = {
  createElement: () => { const f = new FakeFrame(); FakeFrame.all.push(f); return f },
  body: { appendChild: (f: FakeFrame) => f },
} as unknown as Document
const lastFrame = () => FakeFrame.all[FakeFrame.all.length - 1]

function env(nav: PrintNavigator, extra: Partial<PrintEnv> = {}) {
  const timers: (() => void)[] = []
  const revoke = vi.fn()
  const e: PrintEnv = {
    nav,
    doc: fakeDoc,
    url: { createUrl: () => 'blob:x', releaseUrl: revoke },
    open: vi.fn(() => ({})),
    setTimeout: (fn) => timers.push(fn),
    ...extra,
  }
  return { e, timers, revoke }
}

describe('printPdf', () => {
  it('prints through a hidden blob iframe and releases it', async () => {
    const print = vi.fn()
    const { e, timers, revoke } = env({ userAgent: CHROME })
    const p = printPdf(file, e)
    const frame = lastFrame()
    expect(frame.src).toBe('blob:x')
    frame.contentWindow = { focus: vi.fn(), print }
    frame.fire('load')
    expect(await p).toBe('printed')
    expect(print).toHaveBeenCalledOnce()
    timers[1]()
    expect(frame.removed).toBe(true)
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })

  it('prints once from the fallback timer when load never fires', async () => {
    const print = vi.fn()
    const { e, timers } = env({ userAgent: CHROME })
    const p = printPdf(file, e)
    const frame = lastFrame()
    frame.contentWindow = { focus: vi.fn(), print }
    timers[0]()
    expect(await p).toBe('printed')
    frame.fire('load')
    timers[0]()
    expect(print).toHaveBeenCalledOnce()
  })

  it('fails instead of rejecting when the iframe cannot be attached', async () => {
    const { e, revoke } = env({ userAgent: CHROME }, {
      doc: { createElement: () => new FakeFrame(), body: { appendChild: () => { throw new Error('x') } } } as unknown as Document,
    })
    expect(await printPdf(file, e)).toBe('failed')
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })

  it('fails and removes the iframe when print throws', async () => {
    const { e, revoke } = env({ userAgent: CHROME })
    const p = printPdf(file, e)
    const frame = lastFrame()
    frame.contentWindow = { focus: vi.fn(), print: () => { throw new Error('x') } }
    frame.fire('load')
    expect(await p).toBe('failed')
    expect(frame.removed).toBe(true)
    expect(revoke).toHaveBeenCalled()
  })

  it('opens a tab on Safari macOS and fails when the popup is blocked', async () => {
    expect(await printPdf(file, env({ userAgent: SAFARI_MAC }).e)).toBe('opened')
    expect(await printPdf(file, env({ userAgent: SAFARI_MAC }, { open: () => null }).e)).toBe('failed')
  })

  it('shares on phones, and is unavailable without Web Share', async () => {
    const share = vi.fn(() => Promise.resolve())
    const nav = { userAgent: IPHONE, canShare: () => true, share }
    expect(await printPdf(file, env(nav).e)).toBe('shared')
    expect(share).toHaveBeenCalledOnce()
    expect(await printPdf(file, env({ userAgent: ANDROID }).e)).toBe('unavailable')
    const abort = { userAgent: ANDROID, canShare: () => true, share: () => Promise.reject(Object.assign(new Error('a'), { name: 'AbortError' })) }
    expect(await printPdf(file, env(abort).e)).toBe('cancelled')
  })
})
