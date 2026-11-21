import { describe, expect, it } from 'vitest'
import { canContinue, faceStatus } from '../../src/ui/load-step-model.ts'

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
