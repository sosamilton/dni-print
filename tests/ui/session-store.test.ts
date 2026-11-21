import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Quad } from '../../src/core/index.ts'
import { createSessionStore } from '../../src/ui/session-store.ts'
import { fakeBitmap } from '../worker/fake-imaging.ts'

const size = { widthPx: 800, heightPx: 600 }

describe('session store', () => {
  it('setDetectedQuad marks auto; resetQuad returns to it, else to default', () => {
    const s = createSessionStore({ revokeUrl: () => {} })
    s.getState().setFace('front', { sourceSize: size, previewBitmap: fakeBitmap(1, 1) })
    const det: Quad = [{ x: 10, y: 10 }, { x: 700, y: 20 }, { x: 690, y: 500 }, { x: 20, y: 510 }]
    s.getState().setDetectedQuad('front', det)
    expect(s.getState().faces.front).toMatchObject({ quadOrigin: 'auto', quad: det, detectedQuad: det })
    s.getState().setQuad('front', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])
    expect(s.getState().faces.front!.quadOrigin).toBe('manual')
    s.getState().resetQuad('front')
    expect(s.getState().faces.front).toMatchObject({ quadOrigin: 'auto', quad: det })
    s.getState().setFace('front', { sourceSize: size, previewBitmap: fakeBitmap(1, 1) })
    s.getState().setQuad('front', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])
    s.getState().resetQuad('front')
    expect(s.getState().faces.front).toMatchObject({ quadOrigin: 'default', detectedQuad: null })
  })

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

describe('session store copies and pdf urls', () => {
  it('defaults to 2 copies, tracks and revokes pdf urls, resets on clear', () => {
    const revoke = vi.fn()
    const s = createSessionStore({ revokeUrl: revoke, createUrl: () => 'blob:x' })
    expect(s.getState().copies).toBe(2)
    s.getState().setCopies(1)
    expect(s.getState().copies).toBe(1)
    const url = s.getState().createPdfUrl(new Uint8Array([1]))
    expect(s.getState().blobUrls).toEqual([url])
    s.getState().releaseUrl(url)
    expect(revoke).toHaveBeenCalledWith('blob:x')
    expect(s.getState().blobUrls).toEqual([])
    s.getState().clearSession()
    expect(s.getState().copies).toBe(2)
  })
})

describe('session store filter', () => {
  it('defaults to color, bumps no revs when unchanged, and resets on clear', () => {
    const s = createSessionStore({ revokeUrl: () => {} })
    expect(s.getState().filter).toBe('color')
    expect(s.getState().setFilter('color')).toEqual({})
    s.getState().setFilter('bn')
    expect(s.getState().filter).toBe('bn')
    s.getState().clearSession()
    expect(s.getState().filter).toBe('color')
  })

  it('watermark is off by default, caps text, bumps revs only when effective, resets on clear', () => {
    const s = createSessionStore({ revokeUrl: () => {} })
    expect(s.getState().watermarkOn).toBe(false)
    expect(s.getState().setWatermarkOn(true)).toEqual({})
    s.getState().setWatermarkText('a'.repeat(60))
    expect(s.getState().watermarkText).toHaveLength(40)
    s.getState().clearSession()
    expect(s.getState().watermarkOn).toBe(false)
    expect(s.getState().watermarkText).toBe('')
  })

  it('returns revs for effective watermark changes and {} otherwise', () => {
    const s = createSessionStore({ revokeUrl: () => {} })
    s.getState().setFace('front', { sourceSize: size, previewBitmap: fakeBitmap(1, 1) })
    s.getState().setFace('back', { sourceSize: size, previewBitmap: fakeBitmap(1, 1) })
    expect(s.getState().setWatermarkText('Copia')).toEqual({}) // off
    expect(s.getState().setWatermarkText('Copia')).toEqual({}) // unchanged
    const on = s.getState().setWatermarkOn(true)
    expect(Object.keys(on).sort()).toEqual(['back', 'front'])
    expect(on.front).toBe(s.getState().faces.front!.rev)
    expect(Object.keys(s.getState().setWatermarkText('Otra'))).toHaveLength(2)
    s.getState().setWatermarkText('')
    s.getState().setWatermarkOn(false)
    expect(s.getState().setWatermarkOn(true)).toEqual({}) // blank
  })

  it('revokes every blob URL on clearSession', () => {
    const revoked: string[] = []
    let n = 0
    const s = createSessionStore({ revokeUrl: (u) => revoked.push(u), createUrl: () => `blob:test/${n++}` })
    const a = s.getState().createPdfUrl(new Uint8Array([1]))
    const b = s.getState().createPdfUrl(new Uint8Array([2]))
    s.getState().trackBlobUrl('blob:test/extra')
    s.getState().clearSession()
    expect(revoked.sort()).toEqual([a, b, 'blob:test/extra'].sort())
    expect(s.getState().blobUrls).toEqual([])
  })

  it('no src file uses persist or zustand/middleware, and only the store creates blob URLs', () => {
    const srcDir = join(import.meta.dirname, '..', '..', 'src')
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : /\.(m|c)?(t|j)sx?$/.test(e.name) ? [join(dir, e.name)] : [],
      )
    const files = walk(srcDir)
    expect(files.length).toBeGreaterThan(10)
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      expect(text, f).not.toMatch(/zustand\/middleware/)
      expect(text, f).not.toMatch(/\bpersist\b\s*[(,}]/)
      if (!f.endsWith('session-store.ts')) expect(text, f).not.toMatch(/createObjectURL/)
    }
  })
})
