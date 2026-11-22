import { describe, expect, it } from 'vitest'
import type { Quad } from '../../src/core/index.ts'
import type { BitmapLike, FaceId, ProcessingApi, RenderResult } from '../../src/worker/api.ts'
import { createPipelineController, installPagehideClear } from '../../src/ui/pipeline-controller.ts'
import { createSessionStore } from '../../src/ui/session-store.ts'
import { fakeBitmap } from '../worker/fake-imaging.ts'

const GOOD: Quad = [{ x: 10, y: 10 }, { x: 700, y: 20 }, { x: 690, y: 500 }, { x: 20, y: 510 }]

function setup(detect?: () => Promise<unknown>) {
  const renders: Array<{ rev: number; filter?: string; resolve: (r: RenderResult) => void }> = []
  let cleared = 0
  const api = {
    async ingest() {
      return { ok: true, sourceSize: { widthPx: 800, heightPx: 600 }, previewBitmap: fakeBitmap(10, 10) }
    },
    render(_f: FaceId, _q: unknown, _r: unknown, _p: string, rev: number, filter?: string) {
      return new Promise<RenderResult>((resolve) => renders.push({ rev, filter, resolve }))
    },
    detect,
    async clear() {
      cleared++
    },
  } as unknown as ProcessingApi
  const store = createSessionStore({ revokeUrl: () => {} })
  const controller = createPipelineController({ api: { get: () => api, peek: () => api }, store })
  return { store, controller, renders, cleared: () => cleared }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

async function ingestWith(detect: () => Promise<unknown>) {
  const t = setup(detect)
  const p = t.controller.ingest('front', new Blob(['x'], { type: 'image/png' }))
  await tick()
  t.renders[0].resolve({ ok: true, rev: t.renders[0].rev, face: fakeBitmap(1, 1), sharpness: null })
  await p
  return t.store.getState().faces.front!
}

describe('pipeline controller', () => {
  it('stores the rotation computed by the worker as the initial rotation of the face', async () => {
    const f = await ingestWith(async () => ({ ok: true, quad: GOOD, rotation: 180 }))
    expect(f).toMatchObject({ rotation: 180, detectedRotation: 180, quadOrigin: 'auto' })
  })

  it('setQuad recomputes the rotation unless the user already tapped Rotar', async () => {
    const t = setup(async () => ({ ok: true, quad: GOOD, rotation: 0 }))
    const orient: unknown[] = []
    const api = {
      async ingest() { return { ok: true, sourceSize: { widthPx: 800, heightPx: 600 }, previewBitmap: fakeBitmap(10, 10) } },
      async render(_f: FaceId, _q: unknown, rotation: number, _p: string, rev: number) {
        return { ok: true, rev, face: fakeBitmap(1, 1), sharpness: null, rotation }
      },
      async detect() { return { ok: true, quad: GOOD, rotation: 0 } },
      async orient(...args: unknown[]) { orient.push(args); return { ok: true, rotation: 90 } },
      async clear() {},
    } as unknown as ProcessingApi
    const store = createSessionStore({ revokeUrl: () => {} })
    const c = createPipelineController({ api: { get: () => api, peek: () => api }, store })
    void t
    await c.ingest('front', new Blob(['x'], { type: 'image/png' }))
    await c.setQuad('front', GOOD)
    expect(store.getState().faces.front).toMatchObject({ rotation: 90, quadOrigin: 'manual' })
    await c.setRotation('front', 270)
    await c.setQuad('front', GOOD)
    expect(orient).toHaveLength(1)
    expect(store.getState().faces.front!.rotation).toBe(270)
    await c.resetQuad('front')
    expect(store.getState().faces.front).toMatchObject({ rotation: 0, quadOrigin: 'auto' })
  })

  it('passes the render sharpness to the store', async () => {
    const t = setup(async () => ({ ok: true, quad: GOOD }))
    const p = t.controller.ingest('front', new Blob(['x'], { type: 'image/png' }))
    await tick()
    t.renders[0].resolve({ ok: true, rev: t.renders[0].rev, face: fakeBitmap(1, 1), sharpness: 17 })
    await p
    expect(t.store.getState().faces.front!.sharpness).toBe(17)
  })

  it('stores a valid detected quad as auto', async () => {
    const f = await ingestWith(async () => ({ ok: true, quad: GOOD }))
    expect(f).toMatchObject({ quadOrigin: 'auto', quad: GOOD, detectedQuad: GOOD })
  })

  it.each([
    ['null', async () => ({ ok: true, quad: null })],
    ['failure', async () => ({ ok: false, reason: 'detect-failed' })],
    ['throw', async () => { throw new Error('x') }],
    ['invalid', async () => ({ ok: true, quad: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }] })],
  ])('falls back to default on %s', async (_n, detect) => {
    const f = await ingestWith(detect as () => Promise<unknown>)
    expect(f).toMatchObject({ quadOrigin: 'default', detectedQuad: null })
  })

  it('discards a detection when the ingest was replaced', async () => {
    const releases: Array<(v: unknown) => void> = []
    const t = setup(() => new Promise((r) => releases.push(r)))
    const first = t.controller.ingest('front', new Blob(['a']))
    await tick()
    const second = t.controller.ingest('front', new Blob(['b']))
    await tick()
    releases[0]({ ok: true, quad: GOOD })
    expect(await first).toEqual({ ok: false, reason: 'superseded' })
    expect(t.store.getState().faces.front).toBeUndefined()
    releases[1]({ ok: false, reason: 'detect-failed' })
    await tick()
    t.renders[0].resolve({ ok: true, rev: t.renders[0].rev, face: fakeBitmap(1, 1), sharpness: null })
    await second
    expect(t.store.getState().faces.front!.quadOrigin).toBe('default')
  })

  it('detect forwards the worker answer and captures a crash', async () => {
    const ok = { ok: true, quad: null }
    const mk = (detect: () => Promise<unknown>) =>
      createPipelineController({
        api: { get: () => ({ detect }) as unknown as ProcessingApi, peek: () => null },
        store: createSessionStore({ revokeUrl: () => {} }),
      })
    expect(await mk(async () => ok).detect('front')).toEqual(ok)
    expect(await mk(async () => { throw new Error('x') }).detect('front')).toEqual({ ok: false, reason: 'detect-failed' })
  })

  it('drops a render answer whose rev is stale', async () => {
    const { store, controller, renders } = setup()
    const ingest = controller.ingest('front', new Blob(['x'], { type: 'image/png' }))
    await tick()
    const rev2 = renders[0].rev
    const q = store.getState().faces.front!.quad
    const change = controller.setQuad('front', q)
    await tick()
    const rev3 = renders[1].rev
    expect(rev3).toBeGreaterThan(rev2)
    const old: BitmapLike = fakeBitmap(1, 1)
    const fresh: BitmapLike = fakeBitmap(1, 1)
    renders[0].resolve({ ok: true, rev: rev2, face: old, sharpness: null })
    renders[1].resolve({ ok: true, rev: rev3, face: fresh, sharpness: null })
    await Promise.all([ingest, change])
    expect((old as ReturnType<typeof fakeBitmap>).closed).toBe(true)
    expect(store.getState().faces.front!.rendered).toBe(fresh)
    expect(store.getState().faces.front!.rev).toBe(rev3)
  })

  it('clearSession empties the store and calls the worker clear', async () => {
    const { store, controller, renders, cleared } = setup()
    const p = controller.ingest('front', new Blob(['x'], { type: 'image/png' }))
    await tick()
    renders[0].resolve({ ok: true, rev: renders[0].rev, face: fakeBitmap(1, 1), sharpness: null })
    await p
    controller.clearSession()
    await tick()
    expect(store.getState().faces).toEqual({})
    expect(cleared()).toBe(1)
  })

  it('setProfile re-renders every ingested face with a new rev', async () => {
    const { store, controller, renders } = setup()
    const p = controller.ingest('front', new Blob(['x'], { type: 'image/png' }))
    await tick()
    renders[0].resolve({ ok: true, rev: renders[0].rev, face: fakeBitmap(1, 1), sharpness: null })
    await p
    const before = store.getState().faces.front!.rev
    const change = controller.setProfile('licencia-ar')
    await tick()
    expect(store.getState().profileId).toBe('licencia-ar')
    expect(renders[1].rev).toBeGreaterThan(before)
    renders[1].resolve({ ok: true, rev: renders[1].rev, face: fakeBitmap(1, 1), sharpness: null })
    await change
    expect(store.getState().setProfile('nope')).toEqual({})
    expect(store.getState().profileId).toBe('licencia-ar')
  })

  it('setFilter re-renders every ingested face with the new filter', async () => {
    const { store, controller, renders } = setup()
    const p = controller.ingest('front', new Blob(['x'], { type: 'image/png' }))
    await tick()
    expect(renders[0].filter).toBe('color')
    renders[0].resolve({ ok: true, rev: renders[0].rev, face: fakeBitmap(1, 1), sharpness: null })
    await p
    const before = store.getState().faces.front!.rev
    const change = controller.setFilter('ahorro')
    await tick()
    expect(store.getState().filter).toBe('ahorro')
    expect(renders[1].filter).toBe('ahorro')
    expect(renders[1].rev).toBeGreaterThan(before)
    renders[1].resolve({ ok: true, rev: renders[1].rev, face: fakeBitmap(1, 1), sharpness: null })
    await change
    expect(store.getState().setFilter('nope' as never)).toEqual({})
  })

  it('drops an ingest answer that arrives after clearSession', async () => {
    const { store, controller } = setup()
    const preview = fakeBitmap(10, 10)
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const api = {
      async ingest() {
        await gate
        return { ok: true, sourceSize: { widthPx: 800, heightPx: 600 }, previewBitmap: preview }
      },
      async clear() {},
    } as unknown as ProcessingApi
    const c = createPipelineController({ api: { get: () => api, peek: () => api }, store })
    const p = c.ingest('front', new Blob(['x'], { type: 'image/png' }))
    c.clearSession()
    release()
    expect(await p).toEqual({ ok: false, reason: 'superseded' })
    expect(preview.closed).toBe(true)
    expect(store.getState().faces).toEqual({})
    expect(controller).toBeDefined()
  })

  it('survives a rejected render', async () => {
    const { store } = setup()
    const api = {
      async ingest() {
        return { ok: true, sourceSize: { widthPx: 800, heightPx: 600 }, previewBitmap: fakeBitmap(1, 1) }
      },
      async render() {
        throw new Error('worker died')
      },
      async clear() {},
    } as unknown as ProcessingApi
    const c = createPipelineController({ api: { get: () => api, peek: () => api }, store })
    await expect(c.ingest('front', new Blob(['x'], { type: 'image/png' }))).resolves.toMatchObject({ ok: true })
    expect(store.getState().faces.front!.rendered).toBeNull()
  })

  it('clears the session on pagehide', () => {
    const target = new EventTarget()
    let calls = 0
    installPagehideClear(target, { clearSession: () => void calls++ })
    target.dispatchEvent(new Event('pagehide'))
    expect(calls).toBe(1)
  })
})

describe('pipeline controller buildPdf', () => {
  it('sends the layout placements for the chosen copies', async () => {
    let request: any
    const api = {
      async ingest() {
        return { ok: true, sourceSize: { widthPx: 800, heightPx: 600 }, previewBitmap: fakeBitmap(10, 10) }
      },
      async render(_f: FaceId, _q: unknown, _r: unknown, _p: string, rev: number) {
        return { ok: true, rev, face: fakeBitmap(1, 1), sharpness: null }
      },
      async buildPdf(r: unknown) {
        request = r
        return { ok: true, pdf: new Uint8Array([1]) }
      },
      async clear() {},
    } as unknown as ProcessingApi
    const store = createSessionStore({ revokeUrl: () => {} })
    const controller = createPipelineController({ api: { get: () => api, peek: () => api }, store })
    const blob = new Blob(['x'], { type: 'image/png' })
    await controller.ingest('front', blob)
    await controller.ingest('back', blob)
    expect((await controller.buildPdf(2)).ok).toBe(true)
    expect(request.placements).toHaveLength(4)
    expect(request.cutLine).toEqual({ yMm: 148.5, x1Mm: 10, x2Mm: 200 })
    await controller.buildPdf(1)
    expect(request.placements).toHaveLength(2)
    expect(request.cutLine).toBeNull()
    store.getState().setMarginMm(16)
    await controller.buildPdf(2)
    expect(request.cutLine).toEqual({ yMm: 148.5, x1Mm: 16, x2Mm: 194 })
    store.getState().setMarginMm(20) // 2 copies no longer fit
    expect(await controller.buildPdf(2)).toEqual({ ok: false, reason: 'pdf-failed' })
  })

  it('sends each face its own crop and fails cleanly without faces or when the worker throws', async () => {
    let request: any
    let boom = false
    const api = {
      async ingest() {
        return { ok: true, sourceSize: { widthPx: 800, heightPx: 600 }, previewBitmap: fakeBitmap(10, 10) }
      },
      async render(_f: FaceId, _q: unknown, _r: unknown, _p: string, rev: number) {
        return { ok: true, rev, face: fakeBitmap(1, 1), sharpness: null }
      },
      async buildPdf(r: unknown) {
        if (boom) throw new Error('worker gone')
        request = r
        return { ok: true, pdf: new Uint8Array([1]) }
      },
      async clear() {},
    } as unknown as ProcessingApi
    const store = createSessionStore({ revokeUrl: () => {} })
    const controller = createPipelineController({ api: { get: () => api, peek: () => api }, store })
    expect(await controller.buildPdf(2)).toEqual({ ok: false, reason: 'pdf-failed' })
    const blob = new Blob(['x'], { type: 'image/png' })
    await controller.ingest('front', blob)
    await controller.ingest('back', blob)
    await controller.setRotation('back', 90)
    await controller.buildPdf(2)
    expect(request.profileId).toBe(store.getState().profileId)
    expect(request.faces.front).toEqual({ quad: store.getState().faces.front!.quad, rotation: 0 })
    expect(request.faces.back.rotation).toBe(90)
    boom = true
    expect(await controller.buildPdf(2)).toEqual({ ok: false, reason: 'pdf-failed' })
  })

  it('passes the watermark to render and buildPdf', async () => {
    const seen: { render: unknown[]; pdf: unknown[] } = { render: [], pdf: [] }
    const api = {
      async render(_f: FaceId, _q: unknown, _r: unknown, _p: string, rev: number, _fl: unknown, wm: unknown) {
        seen.render.push(wm)
        return { ok: true, rev, face: fakeBitmap(1, 1), sharpness: null } as RenderResult
      },
      async buildPdf(req: { watermark: unknown }) {
        seen.pdf.push(req.watermark)
        return { ok: true, pdf: new Uint8Array() }
      },
      async clear() {},
    } as unknown as ProcessingApi
    const store = createSessionStore({ revokeUrl: () => {} })
    const controller = createPipelineController({ api: { get: () => api, peek: () => api }, store })
    for (const id of ['front', 'back'] as const) store.getState().setFace(id, { sourceSize: { widthPx: 800, heightPx: 600 }, previewBitmap: fakeBitmap(1, 1) })
    await controller.setWatermarkOn(true)
    await controller.setWatermarkText('Copia')
    expect(seen.render.at(-1)).toEqual({ text: 'Copia' })
    await controller.buildPdf(2)
    expect(seen.pdf).toEqual([{ text: 'Copia' }])
  })
})
