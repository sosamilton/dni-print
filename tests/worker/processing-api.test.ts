import { describe, expect, it } from 'vitest'
import { defaultQuad, getProfile, layout, uniformMargins } from '../../src/core/index.ts'
import { createProcessingApi } from '../../src/worker/processing-api.ts'
import { createFakeImaging, type FakeBitmap } from './fake-imaging.ts'
import { makeScene, meanCornerError } from '../core/card-scene.ts'

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
    const r = await api.render('front', q, 0, 'dni-ar', 7, 'color')
    expect(r.ok && r.face.width === 1011 && r.face.height === 638 && r.rev === 7).toBe(true)
  })

  it('reports render failures', async () => {
    const api = createProcessingApi(createFakeImaging())
    const q = defaultQuad(800, 600)
    expect(await api.render('back', q, 0, 'dni-ar', 1, 'color')).toEqual({ ok: false, rev: 1, reason: 'no-source' })
    await api.ingest('back', blob('800x600'))
    expect(await api.render('back', q, 0, 'nope', 2, 'color')).toMatchObject({ ok: false, rev: 2, reason: 'unknown-profile' })
    expect(await api.render('back', [q[0], q[0], q[0], q[0]], 0, 'dni-ar', 3, 'color')).toMatchObject({ reason: 'invalid-quad' })
    expect(await api.render('back', q, 45 as never, 'dni-ar', 4, 'color')).toMatchObject({ reason: 'invalid-quad' })
  })

  it('closes the previous bitmap on re-ingest and on clear', async () => {
    const imaging = createFakeImaging()
    const api = createProcessingApi(imaging)
    await api.ingest('front', blob('800x600'))
    const first = imaging.made[0] as FakeBitmap
    await api.ingest('front', blob('800x600'))
    expect(first.closed).toBe(true)
    const second = imaging.made[2]
    await api.clear()
    expect(second.closed).toBe(true)
    expect(await api.render('front', defaultQuad(8, 6), 0, 'dni-ar', 1, 'color')).toMatchObject({ reason: 'no-source' })
    expect(await api.detect('front')).toEqual({ ok: false, reason: 'no-source' })
  })

  it('keeps nothing from an ingest that clear() overtakes', async () => {
    const imaging = createFakeImaging()
    const api = createProcessingApi(imaging)
    const pending = api.ingest('front', blob('800x600'))
    await api.clear()
    expect(await pending).toEqual({ ok: false, reason: 'superseded' })
    expect(imaging.made.every((b) => b.closed)).toBe(true)
    expect(await api.render('front', defaultQuad(800, 600), 0, 'dni-ar', 1, 'color')).toMatchObject({ reason: 'no-source' })
  })

  it('reports render-failed when the raster backend throws', async () => {
    const imaging = createFakeImaging()
    const api = createProcessingApi({ ...imaging, raster: { ...imaging.raster, createBitmap: async () => { throw new Error('boom') } } })
    await api.ingest('front', blob('800x600'))
    expect(await api.render('front', defaultQuad(800, 600), 0, 'dni-ar', 5, 'color')).toEqual({ ok: false, rev: 5, reason: 'render-failed' })
  })

  it('builds a PDF from both faces and reports failures', async () => {
    const api = createProcessingApi(createFakeImaging())
    const lay = layout(getProfile('dni-ar')!, 2, uniformMargins(10))
    if (!lay.ok) throw new Error('layout')
    const q = defaultQuad(800, 600)
    const crop = { quad: q, rotation: 0 as const }
    const request = { profileId: 'dni-ar', placements: lay.placements, ruler: lay.ruler, cutLine: lay.cutLine, faces: { front: crop, back: crop }, filter: 'color' as const }
    expect(await api.buildPdf(request)).toEqual({ ok: false, reason: 'no-source' })
    await api.ingest('front', blob('800x600'))
    await api.ingest('back', blob('800x600'))
    const r = await api.buildPdf(request)
    expect(r.ok && new TextDecoder().decode(r.pdf.slice(0, 5))).toBe('%PDF-')
    expect(await api.buildPdf({ ...request, profileId: 'nope' })).toEqual({ ok: false, reason: 'unknown-profile' })
    const bad = { ...request, faces: { front: crop, back: { quad: [q[0], q[0], q[0], q[0]] as typeof q, rotation: 0 as const } } }
    expect(await api.buildPdf(bad)).toEqual({ ok: false, reason: 'invalid-quad' })
  })

  describe('detect', () => {
    const quad = (k: number) => [
      { x: 10 * k, y: 10 * k },
      { x: 90 * k, y: 10 * k },
      { x: 90 * k, y: 60 * k },
      { x: 10 * k, y: 60 * k },
    ] as never
    const engine = (detect: (img: { width: number }) => Promise<unknown>) => {
      const calls = { init: 0 }
      return { calls, id: 't', async init() { calls.init++ }, detect } as never
    }

    it('detects on a reduced copy and rescales to source px', async () => {
      const imaging = createFakeImaging()
      let seen = 0
      const api = createProcessingApi(imaging, engine(async (img) => ((seen = img.width), quad(1))))
      await api.ingest('front', blob('6000x3000'))
      const r = await api.detect('front')
      expect(seen).toBe(1024)
      expect(r).toEqual({ ok: true, quad: [
        { x: 40, y: 40 }, { x: 360, y: 40 }, { x: 360, y: 240 }, { x: 40, y: 240 },
      ] })
      expect(imaging.made.at(-1)?.closed).toBe(true)
    })

    it('refines the rescaled quad on the full-resolution source', async () => {
      const imaging = createFakeImaging()
      const truth = [{ x: 200, y: 150 }, { x: 1240, y: 150 }, { x: 1240, y: 806 }, { x: 200, y: 806 }] as never
      const scene = makeScene({ width: 1440, height: 960, corners: truth, supersample: 2 })
      const flat = imaging.readPixels
      imaging.readPixels = (bitmap) => (bitmap.width === scene.width ? scene : flat(bitmap))
      // Reduced copy is 1024 × 683 (k = 1.40625): the engine is a few px off there.
      const k = 1024 / 1440
      const off = [{ x: 3, y: -2 }, { x: -3, y: 3 }, { x: -2, y: -3 }, { x: 3, y: 2 }]
      const engineQuad = (truth as { x: number; y: number }[]).map((p, i) => ({ x: p.x * k + off[i].x, y: p.y * k + off[i].y }))
      const api = createProcessingApi(imaging, engine(async () => engineQuad))
      await api.ingest('front', blob('1440x960'))
      const r = await api.detect('front')
      if (!r.ok || !r.quad) throw new Error('detect')
      const rescaled = engineQuad.map((p) => ({ x: p.x * (1440 / 1024), y: p.y * (960 / 683) })) as never
      expect(meanCornerError(r.quad, truth)).toBeLessThan(meanCornerError(rescaled, truth))
      expect(meanCornerError(r.quad, truth)).toBeLessThan(1)
    })

    it('returns a null quad, and no-source without ingest', async () => {
      const api = createProcessingApi(createFakeImaging(), engine(async () => null))
      expect(await api.detect('back')).toEqual({ ok: false, reason: 'no-source' })
      await api.ingest('back', blob('800x600'))
      expect(await api.detect('back')).toEqual({ ok: true, quad: null })
    })

    it('captures engine failures and retries init', async () => {
      let fail = true
      const calls = { init: 0 }
      const e = { id: 't', async init() { calls.init++; if (fail) throw new Error('x') }, async detect() { return null } } as never
      const api = createProcessingApi(createFakeImaging(), e)
      await api.ingest('front', blob('800x600'))
      expect(await api.detect('front')).toEqual({ ok: false, reason: 'detect-failed' })
      fail = false
      expect(await api.detect('front')).toEqual({ ok: true, quad: null })
      await api.detect('front')
      expect(calls.init).toBe(2)
    })

    it('reports superseded when clear() happens mid-detection', async () => {
      const holder: { api?: ReturnType<typeof createProcessingApi> } = {}
      const api = createProcessingApi(createFakeImaging(), engine(async () => { await holder.api!.clear(); return quad(1) }))
      holder.api = api
      await api.ingest('front', blob('800x600'))
      expect(await api.detect('front')).toEqual({ ok: false, reason: 'superseded' })
    })

    it('reports superseded when the face is re-ingested mid-detection', async () => {
      const holder: { api?: ReturnType<typeof createProcessingApi> } = {}
      const api = createProcessingApi(createFakeImaging(), engine(async () => { await holder.api!.ingest('front', blob('800x600')); return quad(1) }))
      holder.api = api
      await api.ingest('front', blob('800x600'))
      expect(await api.detect('front')).toEqual({ ok: false, reason: 'superseded' })
    })

    it('captures an engine that throws in detect', async () => {
      const api = createProcessingApi(createFakeImaging(), engine(async () => { throw new Error('boom') }))
      await api.ingest('front', blob('800x600'))
      expect(await api.detect('front')).toEqual({ ok: false, reason: 'detect-failed' })
    })

    it('scales each axis separately for non-uniform sources', async () => {
      const api = createProcessingApi(createFakeImaging(), engine(async () => quad(1)))
      await api.ingest('front', blob('2000x500'))
      const r = await api.detect('front')
      expect(r.ok && r.quad?.[2]).toEqual({ x: 90 * (2000 / 1024), y: 60 * (500 / 256) })
    })

    it('reports detect-failed when no engine is wired', async () => {
      const api = createProcessingApi(createFakeImaging())
      await api.ingest('front', blob('800x600'))
      expect(await api.detect('front')).toEqual({ ok: false, reason: 'detect-failed' })
    })
  })

  it.each(['bn', 'ahorro'] as const)('builds a DeviceGray PDF for %s', async (filter) => {
    const api = createProcessingApi(createFakeImaging())
    const lay = layout(getProfile('dni-ar')!, 1, uniformMargins(10))
    if (!lay.ok) throw new Error('layout')
    const crop = { quad: defaultQuad(800, 600), rotation: 0 as const }
    await api.ingest('front', blob('800x600'))
    await api.ingest('back', blob('800x600'))
    const r = await api.buildPdf({ profileId: 'dni-ar', placements: lay.placements, ruler: lay.ruler, cutLine: lay.cutLine, faces: { front: crop, back: crop }, filter })
    if (!r.ok) throw new Error('pdf')
    const text = new TextDecoder('latin1').decode(r.pdf)
    expect(text).toMatch(/\/ColorSpace\s*\/DeviceGray/)
    expect(text).not.toMatch(/\/ColorSpace\s*\/DeviceRGB/)
  })

  it('stamps the watermark in preview and PDF', async () => {
    const imaging = createFakeImaging()
    const api = createProcessingApi(imaging)
    await api.ingest('front', new Blob(['800x500'], { type: 'image/png' }))
    await api.ingest('back', new Blob(['800x500'], { type: 'image/png' }))
    const quad = [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 500 }, { x: 0, y: 500 }] as never
    const r = await api.render('front', quad, 0, 'dni-ar', 1, 'color', { text: 'Copia' })
    expect(r.ok).toBe(true)
    expect(imaging.stamps).toEqual(['Copia'])
    const lay = layout(getProfile('dni-ar')!, 2, uniformMargins(10))
    if (!lay.ok) throw new Error('layout')
    const crop = { quad, rotation: 0 as const }
    const pdf = await api.buildPdf({ profileId: 'dni-ar', placements: lay.placements, ruler: (lay as any).ruler, cutLine: lay.cutLine, faces: { front: crop, back: crop }, filter: 'bn', watermark: { text: 'Copia' } })
    expect(pdf.ok).toBe(true)
    expect(imaging.stamps).toHaveLength(3)
    const jpegCalls: number[] = []
    const enc = imaging.encodeJpeg
    imaging.encodeJpeg = async (px, q) => (jpegCalls.push(px.data[0]!), enc(px, q))
    await api.buildPdf({ profileId: 'dni-ar', placements: lay.placements, ruler: lay.ruler, cutLine: lay.cutLine, faces: { front: crop, back: crop }, filter: 'color', watermark: { text: 'Copia' } })
    expect(jpegCalls).toEqual([77, 77]) // encoded pixels are the stamped ones
    const bad = await api.buildPdf({ profileId: 'dni-ar', placements: lay.placements, ruler: lay.ruler, cutLine: lay.cutLine, faces: { front: crop, back: crop }, filter: 'color', watermark: {} as never })
    expect(bad).toEqual({ ok: false, reason: 'pdf-failed' })
    const before = imaging.stamps.length
    await api.buildPdf({ profileId: 'dni-ar', placements: lay.placements, ruler: lay.ruler, cutLine: lay.cutLine, faces: { front: crop, back: crop }, filter: 'color', watermark: { text: '  ' } })
    expect(imaging.stamps.length).toBe(before)
  })

  it('renders with a filter', async () => {
    const api = createProcessingApi(createFakeImaging())
    await api.ingest('front', blob('800x600'))
    const r = await api.render('front', defaultQuad(800, 600), 0, 'dni-ar', 1, 'bn')
    expect(r.ok).toBe(true)
    expect(await api.render('front', defaultQuad(800, 600), 0, 'dni-ar', 2, 'x' as never)).toMatchObject({ ok: false, reason: 'render-failed' })
  })
})
