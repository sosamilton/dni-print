// Pure platform detection: no DOM access; callers pass the navigator-like data.

export interface NavigatorInfo {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
}

/** iPhone, iPad and iPod; iPadOS 13+ reports itself as a touch-enabled Mac. */
export function isIos(nav: NavigatorInfo): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true
  return (nav.platform === 'MacIntel' || /Macintosh/.test(nav.userAgent)) && (nav.maxTouchPoints ?? 0) > 1
}

/** A desktop or laptop: neither a phone/tablet nor iOS. */
export function isDesktop(nav: NavigatorInfo): boolean {
  return !isIos(nav) && !/Android|Mobile|Tablet/i.test(nav.userAgent)
}

export function currentNavigator(): NavigatorInfo {
  return typeof navigator === 'undefined' ? { userAgent: '' } : navigator
}
