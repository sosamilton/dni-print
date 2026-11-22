// Direct printing of the built PDF, with a strategy chosen per platform.

import { isDesktop } from './platform.ts'
import type { NavigatorInfo } from './platform.ts'
import { sessionStore } from './session-store.ts'
import { canSharePdf, sharePdf } from './share-pdf.ts'
import type { ShareNavigator } from './share-pdf.ts'

/** 'opened': the PDF is in a new tab and the user prints from there. 'shared': the share sheet was used. */
export type PrintOutcome = 'printed' | 'opened' | 'shared' | 'cancelled' | 'unavailable' | 'failed'
export type PrintStrategy = 'iframe' | 'tab' | 'share'

export type PrintNavigator = NavigatorInfo & ShareNavigator

/** Desktop Safari (macOS): Safari without Chrome/Chromium/Edge/Firefox tokens, on a Mac that is not an iPad. */
function isSafariMac(nav: NavigatorInfo): boolean {
  const ua = nav.userAgent
  return /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Firefox|Edg|OPR/.test(ua)
}

/** Pure: how to print on this platform. */
export function planPrint(nav: PrintNavigator): PrintStrategy {
  if (!isDesktop(nav)) return 'share'
  return isSafariMac(nav) ? 'tab' : 'iframe'
}

export interface PrintEnv {
  nav: PrintNavigator
  doc: Document
  url: { createUrl: (blob: Blob) => string; releaseUrl: (url: string) => void }
  open: (url: string) => unknown
  setTimeout: (fn: () => void, ms: number) => unknown
}

const LOAD_WAIT_MS = 3_000
const RELEASE_MS = 60_000
const TAB_RELEASE_MS = 10 * 60_000

function defaultEnv(): PrintEnv {
  return {
    nav: navigator as PrintNavigator,
    doc: document,
    // The session store tracks the blob URL, so «Empezar de nuevo» also revokes it.
    url: {
      createUrl: (blob) => sessionStore.getState().createPdfUrl(blob),
      releaseUrl: (url) => sessionStore.getState().releaseUrl(url),
    },
    open: (url) => window.open(url, '_blank'),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  }
}

/**
 * Prints `file`. Call it inside the click, with no await before it, so the user gesture survives.
 * Never rejects.
 */
export function printPdf(file: File, env: PrintEnv = defaultEnv()): Promise<PrintOutcome> {
  try {
    const strategy = planPrint(env.nav)
    if (strategy === 'share') {
      if (!canSharePdf(env.nav, file)) return Promise.resolve('unavailable')
      return sharePdf(env.nav, file)
    }
    if (strategy === 'tab') return Promise.resolve(printInTab(file, env))
    return printInIframe(file, env)
  } catch {
    return Promise.resolve('failed')
  }
}

function printInTab(file: File, env: PrintEnv): PrintOutcome {
  const url = env.url.createUrl(file)
  const tab = env.open(url)
  if (!tab) {
    env.url.releaseUrl(url)
    return 'failed'
  }
  env.setTimeout(() => env.url.releaseUrl(url), TAB_RELEASE_MS)
  return 'opened'
}

function printInIframe(file: File, env: PrintEnv): Promise<PrintOutcome> {
  const url = env.url.createUrl(file)
  const frame = env.doc.createElement('iframe')
  let released = false
  const release = () => {
    if (released) return
    released = true
    frame.remove()
    env.url.releaseUrl(url)
  }
  return new Promise<PrintOutcome>((resolve) => {
    let settled = false
    const settle = (outcome: PrintOutcome) => {
      if (settled) return
      settled = true
      resolve(outcome)
    }
    frame.setAttribute('aria-hidden', 'true')
    frame.tabIndex = -1
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    let fired = false
    const printNow = () => {
      if (fired) return
      fired = true
      try {
        const win = frame.contentWindow
        if (!win) throw new Error('no window')
        win.focus()
        win.print()
        settle('printed')
        env.setTimeout(release, RELEASE_MS)
      } catch {
        release()
        settle('failed')
      }
    }
    try {
      frame.addEventListener('load', printNow)
      // Some browsers never fire `load` for a PDF in an iframe; print anyway once the blob had time to load.
      env.setTimeout(printNow, LOAD_WAIT_MS)
      frame.src = url
      env.doc.body.appendChild(frame)
    } catch {
      release()
      settle('failed')
    }
  })
}
