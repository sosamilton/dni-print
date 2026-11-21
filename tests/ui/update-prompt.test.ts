import { describe, expect, it, vi } from 'vitest'
import { createUpdatePrompt } from '../../src/ui/update-prompt.ts'

describe('createUpdatePrompt', () => {
  it('shows nothing until notified', () => {
    expect(createUpdatePrompt({ clearSession: vi.fn() }).getSnapshot()).toBe(false)
  })
  it('notifies subscribers', () => {
    const p = createUpdatePrompt({ clearSession: vi.fn() })
    const l = vi.fn()
    p.subscribe(l)
    p.notify(() => {})
    expect(p.getSnapshot()).toBe(true)
    expect(l).toHaveBeenCalled()
  })
  it('clears the session before applying, then hides', async () => {
    const order: string[] = []
    const p = createUpdatePrompt({ clearSession: () => order.push('clear') })
    p.notify(async () => { order.push('apply') })
    await p.update()
    expect(order).toEqual(['clear', 'apply'])
    expect(p.getSnapshot()).toBe(false)
  })
  it('keeps the notice when apply fails', async () => {
    const p = createUpdatePrompt({ clearSession: vi.fn() })
    p.notify(() => Promise.reject(new Error('x')))
    await p.update()
    expect(p.getSnapshot()).toBe(true)
  })
})

describe('createUpdatePrompt edge cases', () => {
  it('ignores a second update() while one is running', async () => {
    const apply = vi.fn(() => new Promise<void>((r) => setTimeout(r, 5)))
    const p = createUpdatePrompt({ clearSession: () => {} })
    p.notify(apply)
    await Promise.all([p.update(), p.update()])
    expect(apply).toHaveBeenCalledOnce()
  })
  it('does nothing without a notification', async () => {
    const clearSession = vi.fn()
    await createUpdatePrompt({ clearSession }).update()
    expect(clearSession).not.toHaveBeenCalled()
  })
  it('keeps the notice and skips apply when clearSession throws', async () => {
    const apply = vi.fn()
    const p = createUpdatePrompt({ clearSession: () => { throw new Error('x') } })
    p.notify(apply)
    await p.update()
    expect(apply).not.toHaveBeenCalled()
    expect(p.getSnapshot()).toBe(true)
  })
})
