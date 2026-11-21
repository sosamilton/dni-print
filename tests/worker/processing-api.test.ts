import { describe, expect, it } from 'vitest'
import { defaultQuad, getProfile, layout, uniformMargins } from '../../src/core/index.ts'
import { createProcessingApi } from '../../src/worker/processing-api.ts'
import { createFakeImaging, type FakeBitmap } from './fake-imaging.ts'

const blob = (text: string, type = 'image/jpeg') => new Blob([text], { type })

describe('processing api', () => {
  it('ingests and caps sizes', async () => {
    const imaging = createFakeImaging()
    const api = createProcessingApi(imaging)
    const r = await api.ingest('front', blob('6000x3000'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.sourceSize).toEqual({ widthPx: 4096, heightPx: 2048 })
      expect(r.previewBitmap.width).toBe(1024)
    }
    expect(imaging.made[0].closed).toBe(true) // original decode closed after downscale
  })

  it('rejects non-images without throwing', async () => {
    const api = createProcessingApi(createFakeImaging())
    expect(await api.ingest('front', blob('800x600', 'text/plain'))).toEqual({ ok: false, reason: 'not-image' })
    expect(await api.ingest('front', blob('garbage'))).toEqual({ ok: false, reason: 'not-image' })
  })

  it('renders ID-1 faces and echoes rev', async () => {
    const api = createProcessingApi(createFakeImaging())
    await api.ingest('front', blob('800x600'))
    const q = defaultQuad(800, 600)
    const r = await api.render('front', q, 0, 'dni-ar', 7)
    expect(r.ok && r.face.width === 1011 && r.face.height === 638 && r.rev === 7).toBe(true)
  })

  it('reports render failures', async () => {
    const api = createProcessingApi(createFakeImaging())
    const q = defaultQuad(800, 600)
    expect(await api.render('back', q, 0, 'dni-ar', 1)).toEqual({ ok: false, rev: 1, reason: 'no-source' })
    await api.ingest('back', blob('800x600'))
    expect(await api.render('back', q, 0, 'nope', 2)).toMatchObject({ ok: false, rev: 2, reason: 'unknown-profile' })
    expect(await api.render('back', [q[0], q[0], q[0], q[0]], 0, 'dni-ar', 3)).toMatchObject({ reason: 'invalid-quad' })
    expect(await api.render('back', q, 45 as never, 'dni-ar', 4)).toMatchObject({ reason: 'invalid-quad' })
  })

  it('closes the previous bitmap on re-ingest and on clear; detect stays a stub', async () => {
    const imaging = createFakeImaging()
    const api = createProcessingApi(imaging)
    await api.ingest('front', blob('800x600'))
    const first = imaging.made[0] as FakeBitmap
    await api.ingest('front', blob('800x600'))
    expect(first.closed).toBe(true)
    const second = imaging.made[2]
    await api.clear()
    expect(second.closed).toBe(true)
    expect(await api.render('front', defaultQuad(8, 6), 0, 'dni-ar', 1)).toMatchObject({ reason: 'no-source' })
    expect(await api.detect('front')).toEqual({ ok: false, reason: 'not-implemented' })
  })

  it('keeps nothing from an ingest that clear() overtakes', async () => {
    const imaging = createFakeImaging()
    const api = createProcessingApi(imaging)
    const pending = api.ingest('front', blob('800x600'))
    await api.clear()
    expect(await pending).toEqual({ ok: false, reason: 'superseded' })
    expect(imaging.made.every((b) => b.closed)).toBe(true)
    expect(await api.render('front', defaultQuad(800, 600), 0, 'dni-ar', 1)).toMatchObject({ reason: 'no-source' })
  })

  it('reports render-failed when the raster backend throws', async () => {
    const imaging = createFakeImaging()
    const api = createProcessingApi({ ...imaging, raster: { createBitmap: async () => { throw new Error('boom') } } })
    await api.ingest('front', blob('800x600'))
    expect(await api.render('front', defaultQuad(800, 600), 0, 'dni-ar', 5)).toEqual({ ok: false, rev: 5, reason: 'render-failed' })
  })

  it('builds a PDF from both faces and reports failures', async () => {
    const api = createProcessingApi(createFakeImaging())
    const lay = layout(getProfile('dni-ar')!, 2, uniformMargins(10))
    if (!lay.ok) throw new Error('layout')
    const q = defaultQuad(800, 600)
    const crop = { quad: q, rotation: 0 as const }
    const request = { profileId: 'dni-ar', placements: lay.placements, ruler: lay.ruler, faces: { front: crop, back: crop } }
    expect(await api.buildPdf(request)).toEqual({ ok: false, reason: 'no-source' })
    await api.ingest('front', blob('800x600'))
    await api.ingest('back', blob('800x600'))
    const r = await api.buildPdf(request)
    expect(r.ok && new TextDecoder().decode(r.pdf.slice(0, 5))).toBe('%PDF-')
    expect(await api.buildPdf({ ...request, profileId: 'nope' })).toEqual({ ok: false, reason: 'unknown-profile' })
    const bad = { ...request, faces: { front: crop, back: { quad: [q[0], q[0], q[0], q[0]] as typeof q, rotation: 0 as const } } }
    expect(await api.buildPdf(bad)).toEqual({ ok: false, reason: 'invalid-quad' })
  })
})
