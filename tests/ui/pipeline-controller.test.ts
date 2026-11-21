import { describe, expect, it } from 'vitest'
import type { BitmapLike, FaceId, ProcessingApi, RenderResult } from '../../src/worker/api.ts'
import { createPipelineController, installPagehideClear } from '../../src/ui/pipeline-controller.ts'
import { createSessionStore } from '../../src/ui/session-store.ts'
import { fakeBitmap } from '../worker/fake-imaging.ts'

function setup() {
  const renders: Array<{ rev: number; resolve: (r: RenderResult) => void }> = []
  let cleared = 0
  const api = {
    async ingest() {
      return { ok: true, sourceSize: { widthPx: 800, heightPx: 600 }, previewBitmap: fakeBitmap(10, 10) }
    },
    render(_f: FaceId, _q: unknown, _r: unknown, _p: string, rev: number) {
      return new Promise<RenderResult>((resolve) => renders.push({ rev, resolve }))
    },
    async clear() {
      cleared++
    },
  } as unknown as ProcessingApi
  const store = createSessionStore({ revokeUrl: () => {} })
  const controller = createPipelineController({ api: { get: () => api, peek: () => api }, store })
  return { store, controller, renders, cleared: () => cleared }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('pipeline controller', () => {
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
    renders[0].resolve({ ok: true, rev: rev2, face: old })
    renders[1].resolve({ ok: true, rev: rev3, face: fresh })
    await Promise.all([ingest, change])
    expect((old as ReturnType<typeof fakeBitmap>).closed).toBe(true)
    expect(store.getState().faces.front!.rendered).toBe(fresh)
    expect(store.getState().faces.front!.rev).toBe(rev3)
  })

  it('clearSession empties the store and calls the worker clear', async () => {
    const { store, controller, renders, cleared } = setup()
    const p = controller.ingest('front', new Blob(['x'], { type: 'image/png' }))
    await tick()
    renders[0].resolve({ ok: true, rev: renders[0].rev, face: fakeBitmap(1, 1) })
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
    renders[0].resolve({ ok: true, rev: renders[0].rev, face: fakeBitmap(1, 1) })
    await p
    const before = store.getState().faces.front!.rev
    const change = controller.setProfile('licencia-ar')
    await tick()
    expect(store.getState().profileId).toBe('licencia-ar')
    expect(renders[1].rev).toBeGreaterThan(before)
    renders[1].resolve({ ok: true, rev: renders[1].rev, face: fakeBitmap(1, 1) })
    await change
    expect(store.getState().setProfile('nope')).toEqual({})
    expect(store.getState().profileId).toBe('licencia-ar')
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
        return { ok: true, rev, face: fakeBitmap(1, 1) }
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
    await controller.buildPdf(1)
    expect(request.placements).toHaveLength(2)
  })

  it('sends each face its own crop and fails cleanly without faces or when the worker throws', async () => {
    let request: any
    let boom = false
    const api = {
      async ingest() {
        return { ok: true, sourceSize: { widthPx: 800, heightPx: 600 }, previewBitmap: fakeBitmap(10, 10) }
      },
      async render(_f: FaceId, _q: unknown, _r: unknown, _p: string, rev: number) {
        return { ok: true, rev, face: fakeBitmap(1, 1) }
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
})
