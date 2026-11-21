import { describe, expect, it } from 'vitest'
import { manifestProblems, precacheProblems, runtimeCachingProblems } from '../../scripts/check-dist-precache.ts'

describe('precacheProblems', () => {
  it('OK when the engine chunk is listed', () => {
    expect(precacheProblems('precacheAndRoute([{url:"assets/scanic-abc.js",revision:null}])')).toEqual([])
    expect(precacheProblems('[{url:"assets/opencv-abc.js",revision:null}]')).toEqual([])
  })
  it('fails without the engine chunk or without a list', () => {
    expect(precacheProblems('[{url:"assets/index-a.js",revision:null}]')).toHaveLength(1)
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
