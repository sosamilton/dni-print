import { describe, expect, it } from 'vitest'
import { isDesktop, isIos } from '../../src/ui/platform.ts'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

describe('platform', () => {
  it('detects iPhone and iPadOS posing as a touch Mac', () => {
    expect(isIos({ userAgent: IPHONE })).toBe(true)
    expect(isIos({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true)
  })

  it('treats a real Mac, Windows and Android as non-iOS', () => {
    expect(isIos({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false)
    expect(isIos({ userAgent: WINDOWS })).toBe(false)
    expect(isIos({ userAgent: ANDROID })).toBe(false)
  })

  it('is desktop only for non-mobile, non-iOS devices', () => {
    expect(isDesktop({ userAgent: WINDOWS })).toBe(true)
    expect(isDesktop({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(true)
    expect(isDesktop({ userAgent: ANDROID })).toBe(false)
    expect(isDesktop({ userAgent: IPHONE })).toBe(false)
    expect(isDesktop({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(false)
  })
})
