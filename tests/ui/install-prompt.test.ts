import { describe, expect, it, vi } from 'vitest'
import { createInstallPrompt } from '../../src/ui/install-prompt.ts'

function fire(target: EventTarget, type: string, extra: object = {}) {
  const e = Object.assign(new Event(type, { cancelable: true }), extra)
  target.dispatchEvent(e)
  return e
}

describe('createInstallPrompt', () => {
  it('is not installable until the browser offers it', () => {
    expect(createInstallPrompt(new EventTarget()).getSnapshot()).toBe(false)
  })
  it('becomes installable on beforeinstallprompt and prompts once', async () => {
    const t = new EventTarget()
    const p = createInstallPrompt(t)
    const listener = vi.fn()
    p.subscribe(listener)
    const prompt = vi.fn(async () => {})
    const e = fire(t, 'beforeinstallprompt', { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    expect(e.defaultPrevented).toBe(true)
    expect(p.getSnapshot()).toBe(true)
    expect(await p.install()).toBe(true)
    expect(prompt).toHaveBeenCalledOnce()
    expect(p.getSnapshot()).toBe(false)
    expect(await p.install()).toBe(false)
  })
  it('keeps the option when the user dismisses or prompt() rejects', async () => {
    const t = new EventTarget()
    const p = createInstallPrompt(t)
    fire(t, 'beforeinstallprompt', { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) })
    expect(await p.install()).toBe(false)
    expect(p.getSnapshot()).toBe(true)
    const t2 = new EventTarget()
    const p2 = createInstallPrompt(t2)
    fire(t2, 'beforeinstallprompt', { prompt: () => Promise.reject(new Error('x')) })
    expect(await p2.install()).toBe(false)
    expect(p2.getSnapshot()).toBe(true)
  })
  it('returns true when accepted', async () => {
    const t = new EventTarget()
    const p = createInstallPrompt(t)
    fire(t, 'beforeinstallprompt', { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    expect(await p.install()).toBe(true)
    expect(p.getSnapshot()).toBe(false)
  })
  it('hides after appinstalled and when already standalone', () => {
    const t = new EventTarget()
    const p = createInstallPrompt(t)
    fire(t, 'beforeinstallprompt', { prompt: async () => {} })
    fire(t, 'appinstalled')
    expect(p.getSnapshot()).toBe(false)
    const t2 = new EventTarget()
    const p2 = createInstallPrompt(t2, () => true)
    fire(t2, 'beforeinstallprompt', { prompt: async () => {} })
    expect(p2.getSnapshot()).toBe(false)
  })
})
