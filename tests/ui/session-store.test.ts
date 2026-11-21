import { describe, expect, it, vi } from 'vitest'
import { createSessionStore } from '../../src/ui/session-store.ts'
import { fakeBitmap } from '../worker/fake-imaging.ts'

const size = { widthPx: 800, heightPx: 600 }

describe('session store', () => {
  it('assigns monotonic revs and closes replaced bitmaps', () => {
    const s = createSessionStore({ revokeUrl: () => {} })
    const p1 = fakeBitmap(10, 10)
    const r1 = s.getState().setFace('front', { sourceSize: size, previewBitmap: p1 })
    const r2 = s.getState().setQuad('front', s.getState().faces.front!.quad)!
    const p2 = fakeBitmap(10, 10)
    const r3 = s.getState().setFace('front', { sourceSize: size, previewBitmap: p2 })
    expect(r1 < r2 && r2 < r3).toBe(true)
    expect(p1.closed).toBe(true)
  })

  it('discards stale or unknown-face renders by closing them', () => {
    const s = createSessionStore({ revokeUrl: () => {} })
    s.getState().setFace('front', { sourceSize: size, previewBitmap: fakeBitmap(1, 1) })
    const rev2 = s.getState().faces.front!.rev
    s.getState().setRotation('front', 90)
    const stale = fakeBitmap(1, 1)
    expect(s.getState().receiveRender('front', rev2, stale)).toBe(false)
    expect(stale.closed).toBe(true)
    const orphan = fakeBitmap(1, 1)
    expect(s.getState().receiveRender('back', 1, orphan)).toBe(false)
    expect(orphan.closed).toBe(true)
    const ok = fakeBitmap(1, 1)
    expect(s.getState().receiveRender('front', s.getState().faces.front!.rev, ok)).toBe(true)
    expect(ok.closed).toBe(false)
  })

  it('clearSession releases everything and never resets rev', () => {
    const revoke = vi.fn()
    const clearWorker = vi.fn()
    const s = createSessionStore({ revokeUrl: revoke, clearWorker })
    const preview = fakeBitmap(1, 1)
    s.getState().setFace('front', { sourceSize: size, previewBitmap: preview })
    const rendered = fakeBitmap(1, 1)
    s.getState().receiveRender('front', s.getState().faces.front!.rev, rendered)
    s.getState().trackBlobUrl('blob:a')
    const before = s.getState().rev
    s.getState().clearSession()
    expect(revoke).toHaveBeenCalledWith('blob:a')
    expect(preview.closed && rendered.closed).toBe(true)
    expect(clearWorker).toHaveBeenCalledOnce()
    expect(s.getState().faces).toEqual({})
    expect(s.getState().rev).toBe(before)
  })
})
