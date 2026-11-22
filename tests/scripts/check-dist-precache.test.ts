import { describe, expect, it } from 'vitest'
import { manifestProblems, precacheProblems, runtimeCachingProblems } from '../../scripts/check-dist-precache.ts'

describe('precacheProblems', () => {
  const sw = (...files: string[]) => `precacheAndRoute([${files.map((f) => `{url:"assets/${f}",revision:null}`).join(',')}])`
  it('OK when the chosen engine chunk is listed', () => {
    expect(precacheProblems(sw('scanic-abc.js'), 'scanic')).toEqual([])
    expect(precacheProblems(sw('opencv-abc.js'), 'opencv')).toEqual([])
    // cardfit lives inside the worker bundle: that is the chunk that must be precached.
    expect(precacheProblems(sw('processing.worker-abc.js'))).toEqual([])
    expect(precacheProblems(sw('processing.worker-abc.js'), 'cardfit')).toEqual([])
  })
  it('does not accept the worker as proof of a scanic or opencv chunk', () => {
    expect(precacheProblems(sw('processing.worker-abc.js'), 'scanic')).toHaveLength(1)
    expect(precacheProblems(sw('processing.worker-abc.js'), 'opencv')).toHaveLength(1)
  })
  it('fails without the engine chunk or without a list', () => {
    expect(precacheProblems(sw('index-a.js'), 'scanic')).toHaveLength(1)
    expect(precacheProblems(sw('index-a.js'))).toHaveLength(1)
    expect(precacheProblems('nothing')).toHaveLength(1)
  })
})

describe('manifestProblems', () => {
  const ok = JSON.stringify({ name: 'A', display: 'standalone', icons: [{ src: 'a.png' }] })
  it('OK for a complete manifest', () => expect(manifestProblems(ok, () => true)).toEqual([]))
  it('flags missing manifest, fields and icon files', () => {
    expect(manifestProblems(null, () => true)).toHaveLength(1)
    expect(manifestProblems('{', () => true)).toHaveLength(1)
    expect(manifestProblems('{}', () => true)).toHaveLength(3)
    expect(manifestProblems(ok, () => false)).toHaveLength(1)
  })
})

describe('runtimeCachingProblems', () => {
  it('allows only the navigation route', () => {
    expect(runtimeCachingProblems('e.registerRoute(new e.NavigationRoute(x))')).toEqual([])
    expect(runtimeCachingProblems('e.registerRoute(/\\.png$/,new e.CacheFirst)')).toHaveLength(1)
  })
})
