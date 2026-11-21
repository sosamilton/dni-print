import { describe, expect, it } from 'vitest'
import { canContinue, faceStatus, thumbnailView } from '../../src/ui/load-step-model.ts'

describe('canContinue', () => {
  it('requires both faces', () => {
    expect(canContinue({})).toBe(false)
    expect(canContinue({ front: {} })).toBe(false)
    expect(canContinue({ back: {} })).toBe(false)
    expect(canContinue({ front: {}, back: {} })).toBe(true)
  })
})

describe('faceStatus', () => {
  const base = { loaded: false, processing: false, error: false }
  it('covers the state matrix', () => {
    expect(faceStatus(base)).toBe('empty')
    expect(faceStatus({ ...base, loaded: true })).toBe('loaded')
    expect(faceStatus({ ...base, processing: true })).toBe('processing')
    expect(faceStatus({ ...base, loaded: true, processing: true })).toBe('processing')
    expect(faceStatus({ ...base, error: true })).toBe('error')
    expect(faceStatus({ ...base, loaded: true, error: true })).toBe('error')
  })
})

describe('thumbnailView', () => {
  const previewBitmap = { width: 1024, height: 768, close() {} }
  const rendered = { width: 1011, height: 638, close() {} }
  it('shows a loading state, never the photo, while a detected face renders', () => {
    expect(thumbnailView({ quadOrigin: 'auto', rendered: null, previewBitmap })).toEqual({ kind: 'loading' })
    expect(thumbnailView({ quadOrigin: 'manual', rendered: null, previewBitmap })).toEqual({ kind: 'loading' })
  })
  it('shows the crop once rendered', () => {
    expect(thumbnailView({ quadOrigin: 'auto', rendered, previewBitmap })).toEqual({ kind: 'rendered', bitmap: rendered })
    expect(thumbnailView({ quadOrigin: 'manual', rendered, previewBitmap })).toEqual({ kind: 'rendered', bitmap: rendered })
  })
  it('shows the photo when the face has no quad', () => {
    expect(thumbnailView({ quadOrigin: 'default', rendered: null, previewBitmap })).toEqual({ kind: 'preview', bitmap: previewBitmap })
    expect(thumbnailView({ quadOrigin: 'default', rendered, previewBitmap })).toEqual({ kind: 'preview', bitmap: previewBitmap })
  })
})
