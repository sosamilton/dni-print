// Pure Web Share helpers: callers inject the navigator, so these run anywhere.

export interface ShareNavigator {
  canShare?: (data: { files: File[] }) => boolean
  share?: (data: { files: File[] }) => Promise<void>
}

export type ShareOutcome = 'shared' | 'cancelled' | 'failed'

export function pdfFileName(copies: 1 | 2): string {
  return `dni-print-${copies}-copias.pdf`
}

/** The shareable PDF file for the session's stored bytes; null when no PDF was built. */
export function pdfFile(pdf: { bytes: Uint8Array; copies: 1 | 2 } | null): File | null {
  if (!pdf) return null
  return new File([pdf.bytes as unknown as ArrayBuffer], pdfFileName(pdf.copies), { type: 'application/pdf' })
}

/** True only when the browser can share this exact file; never throws. */
export function canSharePdf(nav: ShareNavigator, file: File): boolean {
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false
  try {
    return nav.canShare({ files: [file] }) === true
  } catch {
    return false
  }
}

/**
 * Opens the system share sheet. Calls `share` synchronously (no await before it) so the
 * user gesture survives. Never rejects.
 */
export function sharePdf(nav: ShareNavigator, file: File): Promise<ShareOutcome> {
  try {
    if (typeof nav.share !== 'function') return Promise.resolve('failed')
    return Promise.resolve(nav.share({ files: [file] })).then(
      (): ShareOutcome => 'shared',
      (err: unknown): ShareOutcome => (isAbort(err) ? 'cancelled' : 'failed'),
    )
  } catch {
    return Promise.resolve('failed')
  }
}

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
}

export function currentShareNavigator(): ShareNavigator {
  return typeof navigator === 'undefined' ? {} : (navigator as ShareNavigator)
}
